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
#import "BTFileManager.h"
#import <sys/socket.h>
#import <XADMaster/XADArchiveParser.h>
#import <XADMaster/CSMemoryHandle.h>
#import "ECVReadWriteLock.h"
#import "BTErrno.h"

static NSSet *BTArchiveExtensions = nil;
static NSSet *BTIgnoredPaths = nil;
static NSCache *BTNodeByArchivePath = nil;

static void SLDictionarySetObjectForKey(NSMutableDictionary *const dict, id const val, id const key)
{
	if(val) [dict setObject:val forKey:key];
}
static BOOL BTIsArchivePath(NSString *const path)
{
	return [BTArchiveExtensions containsObject:[[path pathExtension] lowercaseString]];
}

@class BTArchive;
@interface BTFileNode : NSObject
{
	@private
	BTArchive *_archive;
	NSMutableDictionary *_childByName;
	NSDictionary *_infoDictionary;
}

- (id)initWithArchive:(BTArchive *const)archive;
- (BTArchive *)archive;

- (NSArray *)childNames;
- (NSArray *)children;
- (BOOL)hasChildren;

- (NSDictionary *)infoDictionary;
- (void)setInfoDictionary:(NSDictionary *const)dict;

- (BTFileNode *)nodeForSubpath:(NSString *const)subpath;
- (BTFileNode *)nodeForSubpath:(NSString *const)subpath createIfNeeded:(BOOL const)flag;
- (BTFileNode *)nodeForSubpathComponents:(NSArray *const)components createIfNeeded:(BOOL const)flag;

- (void)setChild:(BTFileNode *const)node forName:(NSString *const)name;

@end

@interface BTArchive : NSObject <NSLocking>
{
	@private
	NSLock *_lock;
	XADArchiveParser *_parser;
}

- (id)initWithParser:(XADArchiveParser *const)parser;
- (XADArchiveParser *)parser; // FIXME: Do not return the parser directly, wrap it in a threadsafe way.

@end

@interface BTNodeLoader : NSObject
{
	@private
	XADArchiveParser *_parser;
	BTFileNode *_node;
}

+ (BTFileNode *)fileNodeWithParser:(XADArchiveParser *const)parser error:(XADError *const)error;

- (id)initWithParser:(XADArchiveParser *const)parser error:(XADError *const)error;
- (XADArchiveParser *)parser;
- (BTFileNode *)node;

@end

@interface BTFileManager(Private)

- (BOOL)_isArchivePath:(NSString *const)path;
- (NSString *)_archivePathForPath:(NSString *const)path;
- (NSString *)_subpathOfPath:(NSString *const)path fromDirectory:(NSString *const)dirname;
- (NSString *)_subpathOfPath:(NSString *const)path fromArchivePath:(NSString *const)archivePath;

- (BTFileNode *)_nodeForArchivePath:(NSString *const)path;
- (BTFileNode *)_nodeForPath:(NSString *const)path;

@end

@implementation BTFileManager

#pragma mark +NSFileManager

+ (NSFileManager *)defaultManager
{
	NSAssert(0, @"+defaultManager not supported, use +alloc/-init instead.");
	return nil;
}

#pragma mark +NSObject

+ (void)initialize
{
	if([BTFileManager class] != self) return;
	BTArchiveExtensions = [[NSSet setWithArray:[[NSBundle bundleForClass:self] objectForInfoDictionaryKey:@"BTArchiveExtensions"]] copy];
	BTIgnoredPaths = [[NSSet setWithObjects:@"/dev", @"/net", @"/etc", @"/home", @"/opt", @"/tmp", @"/var", @"/mach_kernel.ctfsys", @"/mach.sym", nil] retain];
	BTNodeByArchivePath = [[NSCache alloc] init];
}

#pragma mark -BTFileManager

- (NSString *)realPathForPath:(NSString *const)path
{
	if([super fileExistsAtPath:path]) return path;
	return [self _archivePathForPath:path];
}

#pragma mark -BTFileManager(Private)

- (BOOL)_isArchivePath:(NSString *const)path
{
	return BTIsArchivePath(path);
}
- (NSString *)_archivePathForPath:(NSString *const)path
{
	NSParameterAssert(![super fileExistsAtPath:path]);
	NSString *p = path;
	for(;;) {
		p = [p stringByDeletingLastPathComponent];
		if([@"/" isEqualToString:p]) break;
		if(![super fileExistsAtPath:p]) continue;
		if(![self _isArchivePath:p]) break;
		return p;
	}
	return nil;
}
- (NSString *)_subpathOfPath:(NSString *const)path fromDirectory:(NSString *const)dirname
{
	NSCParameterAssert([dirname hasSuffix:@"/"]);
	NSCParameterAssert(![dirname hasSuffix:@"//"]);
	if(![path hasPrefix:dirname]) return nil;
	return [path substringFromIndex:[dirname length]];
}
- (NSString *)_subpathOfPath:(NSString *const)path fromArchivePath:(NSString *const)archivePath
{
	return [self _subpathOfPath:path fromDirectory:[archivePath stringByAppendingString:@"/"]];
}

#pragma mark -

- (BTFileNode *)_nodeForArchivePath:(NSString *const)path
{
	if(!path) return nil;
	BTFileNode *node = [BTNodeByArchivePath objectForKey:path];
	if(node) return node;
	XADArchiveParser *const parser = [XADArchiveParser archiveParserForPath:path error:NULL];
	node = [BTNodeLoader fileNodeWithParser:parser error:NULL];
	[BTNodeByArchivePath setObject:node forKey:path];
	return node;
}
- (BTFileNode *)_nodeForPath:(NSString *const)path
{
	NSString *const archivePath = [self _archivePathForPath:path];
	if(!archivePath) return nil;
	NSString *const subpath = [self _subpathOfPath:path fromArchivePath:archivePath];
	return [[self _nodeForArchivePath:archivePath] nodeForSubpath:subpath];
}

#pragma mark -NSFileManager

- (NSArray *)contentsOfDirectoryAtPath:(NSString *const)path error:(NSError **const)error
{
	if(error) *error = nil;
	if(![super fileExistsAtPath:path]) { // Might be faster to just call -contentsOfDirectory… right away, and check if it fails.
		return [[self _nodeForPath:path] childNames]; // TODO: Error.
	} else if([self _isArchivePath:path]) {
		return [[self _nodeForArchivePath:path] childNames];
	} else {
		return [super contentsOfDirectoryAtPath:path error:error];
	}
}
- (NSDictionary *)attributesOfItemAtPath:(NSString *const)path error:(NSError **const)error
{
	if(error) *error = nil;
	BOOL const checkingForBundle = [@"Contents" isEqualToString:[path lastPathComponent]];
	if(checkingForBundle) {
		BOOL const insideAnArchive = [self _isArchivePath:[path stringByDeletingLastPathComponent]];
		if(insideAnArchive) {
			NSDictionary *const tooExpensive = nil; // TODO: It's only too expensive if we haven't already loaded the archive...
			return tooExpensive;
		}
	}
	if(![super fileExistsAtPath:path]) { // Might be faster to just call -contentsOfDirectory… right away, and check if it fails.
		NSString *const archivePath = [self _archivePathForPath:path];
		if(!archivePath) return nil; // TODO: Error.
		NSString *const subpath = [self _subpathOfPath:path fromArchivePath:archivePath];
		BTFileNode *const node = [[self _nodeForArchivePath:archivePath] nodeForSubpath:subpath];
		if(!node) return nil; // TODO: Error.
		NSDictionary *const info = [node infoDictionary];
		BOOL const isDir = [[info objectForKey:XADIsDirectoryKey] boolValue] || [node hasChildren];
		NSMutableDictionary *const dict = [NSMutableDictionary dictionary];
		[dict setObject:isDir ? NSFileTypeDirectory : NSFileTypeRegular forKey:NSFileType];
		SLDictionarySetObjectForKey(dict, [info objectForKey:XADFileSizeKey], NSFileSize);
		NSDate *modificationDate = [info objectForKey:XADLastModificationDateKey];
		NSDate *creationDate = [info objectForKey:XADCreationDateKey];
		if(!modificationDate || !creationDate) {
			NSDictionary *const archiveAttrs = [self attributesOfItemAtPath:archivePath error:NULL];
			NSDate *const date = [archiveAttrs objectForKey:NSFileModificationDate] ?: [archiveAttrs objectForKey:NSFileCreationDate];
			if(!modificationDate) modificationDate = date;
			if(!creationDate) creationDate = date;
		}
		SLDictionarySetObjectForKey(dict, modificationDate, NSFileModificationDate);
		SLDictionarySetObjectForKey(dict, creationDate, NSFileCreationDate);
		return dict;
	} else if([self _isArchivePath:path]) {
		NSMutableDictionary *const attrs = [[[super attributesOfItemAtPath:path error:error] mutableCopy] autorelease];
		[attrs setObject:NSFileTypeDirectory forKey:NSFileType];
		return attrs;
	} else {
		return [super attributesOfItemAtPath:path error:error];
	}
}
- (NSData *)contentsAtPath:(NSString *)path
{
	if(![super fileExistsAtPath:path]) { // Might be faster to just call -contentsOfDirectory… right away, and check if it fails.
		BTFileNode *const node = [self _nodeForPath:path];
		BTArchive *const archive = [node archive];
		[archive lock];
		CSHandle *const handle = [[archive parser] handleForEntryWithDictionary:[node infoDictionary] wantChecksum:NO error:NULL];
		NSData *const data = [handle remainingFileContents];
		[archive unlock];
		return data;
//	} else if([self _isArchivePath:path]) {
//		return nil;
	} else {
		return [super contentsAtPath:path];
	}
}
- (BOOL)fileExistsAtPath:(NSString *const)path
{
	return [self fileExistsAtPath:path isDirectory:NULL];
}
- (BOOL)fileExistsAtPath:(NSString *const)path isDirectory:(BOOL *const)isDirectory
{
	if([super fileExistsAtPath:path isDirectory:isDirectory]) {
		if(isDirectory) *isDirectory = *isDirectory || [self _isArchivePath:path];
		return YES;
	}
	BTFileNode *const node = [self _nodeForPath:path];
	if(isDirectory) *isDirectory = [[[node infoDictionary] objectForKey:XADIsDirectoryKey] boolValue] || [node hasChildren];
	return !!node;
}

#pragma mark -NSFileManager(BTFileManagerAdditions)

- (NSImage *)iconForPath:(NSString *const)path
{
	if(![super fileExistsAtPath:path]) {
		IconRef iconRef = NULL;
		NSString *const ext = [path pathExtension];
		if(GetIconRefFromTypeInfo('????', kGenericFolderIcon, BTEqualObjects(@"", ext) ? NULL : (CFStringRef)ext, NULL, kIconServicesNormalUsageFlag, &iconRef) == noErr) {
			NSImage *const image = [[[NSImage alloc] initWithIconRef:iconRef] autorelease];
			ReleaseIconRef(iconRef);
			return image;
		}
	}
	return [super iconForPath:path];
}
- (BOOL)sendFileAtPath:(NSString *const)path toSocket:(int const)socket
{
	BOOL isDir = NO;
	if([super fileExistsAtPath:path isDirectory:&isDir]) {
		if(isDir) return NO;
		int const fd = open([path fileSystemRepresentation], O_RDONLY); // We can't call super because SLHTTPServer expects to be able to send archives directly.
		if(-1 == fd) return NO;
		off_t len = 0;
		BTErrno(sendfile(fd, socket, 0, &len, NULL, 0));
		(void)close(fd);
		return YES;
	} else {
		NSData *const data = [self contentsAtPath:path];
		if(!data) return NO;
		BTErrno(write(socket, [data bytes], [data length]));
		return YES;
	}
}

@end

@implementation BTFileNode

#pragma mark -BTFileNode

- (id)initWithArchive:(BTArchive *const)archive
{
	if((self = [super init])) {
		_archive = [archive retain];
		_childByName = [[NSMutableDictionary alloc] init];
	}
	return self;
}
- (BTArchive *)archive
{
	return [[_archive retain] autorelease];
}

#pragma mark -

- (NSArray *)childNames
{
	return [_childByName allKeys];
}
- (NSArray *)children
{
	return [_childByName allValues];
}
- (BOOL)hasChildren
{
	return [[self childNames] count] > 0;
}

#pragma mark -

- (NSDictionary *)infoDictionary
{
	return [[_infoDictionary retain] autorelease];
}
- (void)setInfoDictionary:(NSDictionary *const)dict
{
	[_infoDictionary autorelease];
	_infoDictionary = [dict retain];
}

#pragma mark -

- (BTFileNode *)nodeForSubpath:(NSString *const)subpath
{
	return [self nodeForSubpath:subpath createIfNeeded:NO];
}
- (BTFileNode *)nodeForSubpath:(NSString *const)subpath createIfNeeded:(BOOL const)flag
{
	return [self nodeForSubpathComponents:[subpath componentsSeparatedByString:@"/"] createIfNeeded:flag];
}
- (BTFileNode *)nodeForSubpathComponents:(NSArray *const)components createIfNeeded:(BOOL const)flag
{
	NSUInteger const len = [components count];
	if(!len) return self;
	NSString *const component = [components objectAtIndex:0];
	BTFileNode *node = [_childByName objectForKey:component];
	if(!node) {
		if(!flag) return nil;
		node = [[[BTFileNode alloc] initWithArchive:_archive] autorelease];
		[_childByName setObject:node forKey:component];
	}
	return [node nodeForSubpathComponents:[components subarrayWithRange:NSMakeRange(1, len - 1)] createIfNeeded:flag];
}

#pragma mark -

- (void)setChild:(BTFileNode *const)node forName:(NSString *const)name
{
	[_childByName setObject:node forKey:name];
}

#pragma mark -NSObject

- (void)dealloc
{
	[_archive release];
	[_childByName release];
	[_infoDictionary release];
	[super dealloc];
}

@end

@implementation BTArchive

#pragma mark -BTArchive

- (id)initWithParser:(XADArchiveParser *const)parser
{
	if((self = [super init])) {
		_lock = [[NSLock alloc] init];
		_parser = [parser retain];
	}
	return self;
}
- (XADArchiveParser *)parser
{
	return [[_parser retain] autorelease];
}

#pragma mark -BTArchive<NSLocking>

- (void)lock
{
	[_lock lock];
}
- (void)unlock
{
	[_lock unlock];
}

#pragma mark -NSObject

- (void)dealloc
{
	[_lock release];
	[_parser release];
	[super dealloc];
}

@end

@implementation BTNodeLoader

#pragma mark +BTNodeLoader

+ (BTFileNode *)fileNodeWithParser:(XADArchiveParser *const)parser error:(XADError *const)error
{
	return [[[[self alloc] initWithParser:parser error:error] autorelease] node];
}

#pragma mark -BTNodeLoader

- (id)initWithParser:(XADArchiveParser *const)parser error:(XADError *const)error
{
	NSParameterAssert(parser);
	if((self = [super init])) {
		_parser = [parser retain];
		[_parser setDelegate:self];
		_node = [[BTFileNode alloc] initWithArchive:[[[BTArchive alloc] initWithParser:parser] autorelease]];

		XADError const err = [parser parseWithoutExceptions];
		if(error) *error = err;

		NSArray *const subNodes = [_node children];
		if(1 == [subNodes count]) {
			BTFileNode *const subNode = [subNodes objectAtIndex:0];
			BOOL const isIntermediateFolder = [subNode hasChildren];
			if(isIntermediateFolder) {
				BOOL const isPackage = !![subNode nodeForSubpath:@"Contents"];
				if(!isPackage) {
					[_node autorelease];
					_node = [subNode retain];
				}
			}
		}
	}
	return self;
}
- (XADArchiveParser *)parser
{
	return [[_parser retain] autorelease];
}
- (BTFileNode *)node
{
	return [[_node retain] autorelease];
}

#pragma mark -NSObject

- (void)dealloc
{
	[_parser release];
	[_node release];
	[super dealloc];
}

#pragma mark -NSObject(XADArchiveParserDelegate)

- (void)archiveParser:(XADArchiveParser *const)parser foundEntryWithDictionary:(NSDictionary *const)dict
{
	NSParameterAssert(parser == _parser);
	NSArray *const components = [(XADPath *)[dict objectForKey:XADFileNameKey] pathComponents];
	NSUInteger const count = [components count];
	XADArchiveParser *subParser = nil;
	if(count && BTIsArchivePath([components lastObject])) {
		// Do it this way so every archive is completely independent for threading purposes.
		CSHandle *const handle = [_parser handleForEntryWithDictionary:dict wantChecksum:NO error:NULL];
		NSData *const data = [handle remainingFileContents];
		if(data) subParser = [XADArchiveParser archiveParserForHandle:[CSMemoryHandle memoryHandleForReadingData:data] name:[components lastObject] error:NULL];
	}
	if(subParser) {
		BTFileNode *const node = [BTNodeLoader fileNodeWithParser:subParser error:NULL];
		BTFileNode *const parent = [_node nodeForSubpathComponents:[components subarrayWithRange:NSMakeRange(0, count - 1)] createIfNeeded:YES];
		[parent setChild:node forName:[components lastObject]];
		[node setInfoDictionary:dict];
	} else {
		[[_node nodeForSubpathComponents:components createIfNeeded:YES] setInfoDictionary:dict];
	}
}

@end

@implementation NSFileManager(BTFileManagerAdditions)

#pragma mark -NSFileManager(BTFileManagerAdditions)

- (BOOL)isVisibleAtPath:(NSString *const)path
{
	NSParameterAssert(BTIgnoredPaths);
	if([BTIgnoredPaths containsObject:path]) return NO;
	if([[path lastPathComponent] hasPrefix:@"."]) return NO; // FIXME: Shouldn't we just search for "/."? Since we don't support relative paths that should catch everything.
	if(![self fileExistsAtPath:path]) return YES;
	LSItemInfoRecord info = {};
	if(LSCopyItemInfoForURL((CFURLRef)[NSURL fileURLWithPath:path], kLSRequestBasicFlagsOnly, &info) == noErr && info.flags & kLSItemInfoIsInvisible) return NO;
	return YES;
}
- (NSImage *)iconForPath:(NSString *const)path
{
	return [[NSWorkspace sharedWorkspace] iconForFile:path];
}
- (BOOL)sendFileAtPath:(NSString *const)path toSocket:(int const)socket
{
	BOOL isDir = NO;
	if(![self fileExistsAtPath:path isDirectory:&isDir] || isDir) return NO;
	int const fd = open([path fileSystemRepresentation], O_RDONLY);
	if(-1 == fd) return NO;
	off_t len = 0;
	BTErrno(sendfile(fd, socket, 0, &len, NULL, 0));
	(void)close(fd);
	return YES;
}

@end
