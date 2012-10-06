/* Copyright (c) 2012, Ben Trask
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY BEN TRASK ''AS IS'' AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL BEN TRASK BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */
#import "SLDocumentController.h"

#import "SLPreferenceController.h"
#import "SLHTTPServer.h"
#import "SLServerDispatcher.h"

NSString *const SLShowOpenPanelOnLaunchKey = @"SLShowOpenPanelOnLaunch";
NSString *const SLPreferredBrowserBundleIdentifierKey = @"SLPreferredBrowserBundleIdentifier";
NSString *const SLBlockRemoteConnectionsKey = @"SLBlockRemoteConnections";
NSString *const SLPortKey = @"SLPort";

static NSString *SLHostName(void)
{
	// -[NSProcessInfo hostName] blocks in -[NSHost currentHost] if we have a bad domain name server. I think this version avoids that problem.
	// For future reference, the blocking happens in getnameinfo(). I don't think that function is even used to get the host name we want.
	// I tried it but it always just returned "localhost".
	long const max = sysconf(_SC_HOST_NAME_MAX) + 1;
	char *const hostname = calloc(max, 1);
	NSString *const host = gethostname(hostname, max) == -1 ? @"localhost" : [NSString stringWithUTF8String:hostname];
	free(hostname);
	return host;
}

@interface SLDocumentController(Private)

- (void)_restartServer;

@end

@implementation SLDocumentController

#pragma mark +NSObject

+ (void)initialize
{
	if([SLDocumentController class] != self) return;
	NSUserDefaults *const d = [NSUserDefaults standardUserDefaults];
	[d registerDefaults:[NSDictionary dictionaryWithObjectsAndKeys:
		[NSNumber numberWithBool:YES], SLShowOpenPanelOnLaunchKey,
		[NSNumber numberWithBool:YES], SLBlockRemoteConnectionsKey,
		[NSNumber numberWithUnsignedShort:9001], SLPortKey,
		nil]];
}

#pragma mark -SLDocumentController

- (IBAction)showPreferences:(id)sender
{
	[[SLPreferenceController sharedPreferenceController] showWindow:sender];
}
- (IBAction)invalidateAllURLs:(id)sender
{
	NSError *error = nil;
	NSInteger const result = [[NSAlert alertWithMessageText:NSLocalizedString(@"Are you sure you want to permanently invalidate all Sequential image URLs?", nil) defaultButton:NSLocalizedString(@"Invalidate URLs", nil) alternateButton:NSLocalizedString(@"Cancel", nil) otherButton:nil informativeTextWithFormat:NSLocalizedString(@"Any bookmarks to images in Sequential will be no longer usable.", nil)] runModal];
	if(NSAlertDefaultReturn != result) return;
	if(![_dispatcher invalidateAllURLsError:&error]) (void)[[NSAlert alertWithError:error] runModal];
}
- (IBAction)clearThumbnailCache:(id)sender
{
	NSError *error = nil;
	if(![_dispatcher clearThumbnailCacheError:&error]) (void)[[NSAlert alertWithError:error] runModal];
}
- (IBAction)openLicense:(id)sender
{
	(void)[[NSWorkspace sharedWorkspace] openFile:[[NSBundle mainBundle] pathForResource:@"LICENSE" ofType:@""]]; // TODO: Better display method than opening TextEdit or the default editor?
}

#pragma mark -

- (void)handleGetURLEvent:(NSAppleEventDescriptor *const)event withReplyEvent:(NSAppleEventDescriptor *const)replyEvent
{
	if([event eventClass] != kInternetEventClass) return;
	if([event eventID] != kAEGetURL) return;
	NSURL *const URL = [NSURL URLWithString:[[event paramDescriptorForKeyword:keyDirectObject] stringValue]];
	if(!BTEqualObjects(@"x-sequential", [URL scheme])) return;
	[_dispatcher performAction:[URL path]];
}

#pragma mark -SLDocumentController<NSApplicationDelegate>

- (BOOL)applicationShouldOpenUntitledFile:(NSApplication *const)sender
{
	return [[NSUserDefaults standardUserDefaults] boolForKey:SLShowOpenPanelOnLaunchKey];
}
- (BOOL)applicationOpenUntitledFile:(NSApplication *const)sender
{
	[self openDocument:sender];
	return YES;
}
- (BOOL)application:(NSApplication *const)sender openFile:(NSString *const)path
{
	NSString *const hash = [_dispatcher hashForPath:path persistent:YES];
	if(!hash) return NO;
	NSURL *const URL = [NSURL URLWithString:[NSString stringWithFormat:@"http://localhost:%lu/id/%@/", (unsigned long)[[[NSUserDefaults standardUserDefaults] objectForKey:SLPortKey] unsignedShortValue], hash]];
	if(!URL) return NO;
	[self noteNewRecentDocumentURL:[NSURL fileURLWithPath:path]];
	return [[NSWorkspace sharedWorkspace] openURLs:[NSArray arrayWithObject:URL] withAppBundleIdentifier:[[NSUserDefaults standardUserDefaults] objectForKey:SLPreferredBrowserBundleIdentifierKey] options:NSWorkspaceLaunchDefault additionalEventParamDescriptor:nil launchIdentifiers:NULL];
}

#pragma mark -SLDocumentController(Private)

- (void)_restartServer
{
	NSUserDefaults *const d = [NSUserDefaults standardUserDefaults];
	[_server close];
	[_server listenOnPort:[[d objectForKey:SLPortKey] unsignedShortValue] address:[[d objectForKey:SLBlockRemoteConnectionsKey] boolValue] ? INADDR_LOOPBACK : INADDR_ANY];
}

#pragma mark -NSDocumentController

- (NSInteger)runModalOpenPanel:(NSOpenPanel *const)openPanel forTypes:(NSArray *const)types
{
	[openPanel setCanChooseDirectories:YES];
	return [super runModalOpenPanel:openPanel forTypes:types];
}
- (IBAction)openDocument:(id)sender
{
	NSArray *const URLs = [self URLsFromRunningOpenPanel];
	for(NSURL *const URL in URLs) {
		(void)[self application:nil openFile:[URL path]];
	}
}

#pragma mark -NSObject

- (id)init
{
	if(!(self = [super init])) return nil;

	_server = [[SLHTTPServer alloc] init];
	_dispatcher = [[SLServerDispatcher alloc] init];
	[_server addListener:@"request" block:^(SLHTTPRequest *const req, SLHTTPResponse *const res) {
		[_dispatcher serveReq:req res:res];
	}];
	[[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(_restartServer) name:SLPortKey object:[NSUserDefaults standardUserDefaults]];
	[[NSUserDefaults standardUserDefaults] addObserver:self forKeyPath:SLBlockRemoteConnectionsKey options:kNilOptions context:NULL];
	[self _restartServer];

	[[NSAppleEventManager sharedAppleEventManager] setEventHandler:self andSelector:@selector(handleGetURLEvent:withReplyEvent:) forEventClass:kInternetEventClass andEventID:kAEGetURL];

	return self;
}
- (void)dealloc
{
	[[NSAppleEventManager sharedAppleEventManager] removeEventHandlerForEventClass:kInternetEventClass andEventID:kAEGetURL];
	[_server release];
	[_dispatcher release];
	[super dealloc];
}

#pragma mark -NSObject(NSKeyValueObserving)

- (void)observeValueForKeyPath:(NSString *const)keyPath ofObject:(id const)object change:(NSDictionary *const)change context:(void *const)context
{
	if(BTEqualObjects(SLBlockRemoteConnectionsKey, keyPath)) return [self _restartServer];
	[super observeValueForKeyPath:keyPath ofObject:object change:change context:context];
}

#pragma mark -NSObject(NSMenuValidation)

- (BOOL)validateMenuItem:(NSMenuItem *const)item
{
	SEL const action = [item action];
	if(@selector(invalidateAllURLs:) == action) {
		if(![_dispatcher hasValidURLs]) return NO;
	}
	if(@selector(clearThumbnailCache:) == action) {
		if(![_dispatcher hasCachedThumbnails]) return NO;
	}
	return [self respondsToSelector:action];
}

@end
