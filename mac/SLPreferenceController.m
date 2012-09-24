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
#import "SLPreferenceController.h"
#import "PGAttachments.h"
#import "SLAdditions.h"

extern NSString *const SLShowOpenPanelOnLaunchKey;
extern NSString *const SLPreferredBrowserBundleIdentifierKey;
extern NSString *const SLPortKey;

@implementation SLPreferenceController

#pragma mark +SLPreferenceController

+ (id)sharedPreferenceController
{
	static SLPreferenceController *shared = nil;
	if(!shared) shared = [[self alloc] init];
	return shared;
}

#pragma mark -SLPreferenceController

- (IBAction)takePreferredBrowserFrom:(id)sender
{
	[[NSUserDefaults standardUserDefaults] setObject:[[sender selectedItem] representedObject] forKey:SLPreferredBrowserBundleIdentifierKey];
}
- (IBAction)takePortFrom:(id)sender
{
	NSInteger const val = [sender integerValue];
	if(val <= 1024 || val > USHRT_MAX) { // I fought with NSNumberFormatter for hours before just doing it this way.
		NSBeep();
	} else {
		[[NSUserDefaults standardUserDefaults] setObject:[NSNumber numberWithInteger:[sender integerValue]] forKey:SLPortKey];
		[[NSNotificationCenter defaultCenter] postNotificationName:SLPortKey object:[NSUserDefaults standardUserDefaults]];
	}
	[sender setStringValue:[[[NSUserDefaults standardUserDefaults] objectForKey:SLPortKey] stringValue]];
}

#pragma mark -SLPreferenceController<NSWindowDelegate>

- (void)windowWillClose:(NSNotification *)notif
{
	(void)[[self window] makeFirstResponder:nil];
}

#pragma mark -NSWindowController

- (void)windowDidLoad
{
	[super windowDidLoad];
	[[self window] center];
	[portField setIntegerValue:[[[NSUserDefaults standardUserDefaults] objectForKey:SLPortKey] integerValue]];
}

#pragma mark -NSObject

- (id)init
{
	return [self initWithWindowNibName:@"SLPreferences"];
}

#pragma mark -NSObject(NSNibAwaking)

- (void)awakeFromNib
{
	NSMenu *const m = [browserPopUp menu];
	NSMutableSet *const identSet = [NSMutableSet setWithArray:[(id)LSCopyAllHandlersForURLScheme((CFStringRef)@"http") autorelease]];
	[identSet intersectSet:[NSSet setWithArray:[(id)LSCopyAllHandlersForURLScheme((CFStringRef)@"https") autorelease]]];
	NSString *const def = [[NSUserDefaults standardUserDefaults] objectForKey:SLPreferredBrowserBundleIdentifierKey] ?: [(id)LSCopyDefaultHandlerForURLScheme((CFStringRef)@"https") autorelease];
	NSMutableArray *const items = [NSMutableArray array];
	for(NSString *const ident in identSet) {
		NSURL *const appURL = [[NSWorkspace sharedWorkspace] URLForApplicationWithBundleIdentifier:ident];
		if(![appURL isFileURL]) continue;
		NSString *const appPath = [appURL path];
		NSString *appName = SLDisplayName(appPath);
		if([appName hasSuffix:@".app"]) appName = [appName stringByDeletingPathExtension];

		NSMenuItem *const item = [[[NSMenuItem alloc] init] autorelease];
		[item setAttributedTitle:[NSAttributedString PG_attributedStringWithFileIcon:[[NSWorkspace sharedWorkspace] iconForFile:appPath] name:appName]];
		[item setRepresentedObject:ident];
		[items addObject:item];
	}
	[items sortWithOptions:kNilOptions usingComparator:^(NSMenuItem *const a, NSMenuItem *const b) {
		return [[[a attributedTitle] string] compare:[[b attributedTitle] string]];
	}];
	for(NSMenuItem *const item in items) {
		[m addItem:item];
		if(BTEqualObjects(def, [item representedObject])) [browserPopUp selectItem:item];
	}

	[super awakeFromNib];
}

@end
