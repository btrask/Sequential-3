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
#import "SLServerDispatcher.h"
#include <openssl/sha.h>
#include <openssl/bio.h>
#include <openssl/evp.h>

#import "SLThumbnailCache.h"
#import "SLHTTPServer.h"
#import "SLBase64.h"
#import "SLAdditions.h"
#import "BTFileManager.h"

NSString *const SLHashSecretKey = @"SLHashSecret";

static NSString *SLApplicationSupportPath = nil;
static NSString *SLFilesPath = nil;
static NSString *SLThumbnailsPath = nil;
static NSString *SLIconsPath = nil;
static NSSet *SLImageExtentions = nil;

static Arr SLComponentsFromPath(Str path)
{
	Len a = [path hasPrefix:@"/"] ? 1 : 0;
	Len b = [path hasSuffix:@"/"] ? 1 : 0;
	Len l = [path length];
	if(a + b >= l) return [NSArray array];
	Str trimmed = [path substringWithRange:NSMakeRange(a, l - a - b)];
	return [trimmed componentsSeparatedByString:@"/"];
}
static Str SLPathFromComponents(Arr components)
{
	if(![components count]) return @"";
	return [@"/" stringByAppendingString:[components componentsJoinedByString:@"/"]];
}
static Dic SLParseQuery(Str query)
{
	NSMutableDictionary *const dict = [NSMutableDictionary dictionary];
	NSArray *const pairs = [query componentsSeparatedByString:@"&"];
	for(NSString *const pair in pairs) {
		NSArray *const kv = [pair componentsSeparatedByString:@"="];
		NSString *const key = [kv objectAtIndex:0];
		NSString *const value = [kv count] <= 1 ? @"" : [kv objectAtIndex:1];
		[dict setObject:value forKey:key];
	}
	return dict;
}
static NSNumber *SLDateToNumber(NSDate *const date)
{
	if(!date) return [NSNumber numberWithDouble:0.0];
	return [NSNumber numberWithDouble:1000.0 * [date timeIntervalSince1970]];
}
static BOOL SLIsImagePath(Str path)
{
	return [SLImageExtentions containsObject:[[path pathExtension] lowercaseString]];
}
static Str SLRandomString(Len length)
{
	static char const map[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	                          "abcdefghijklmnopqrstuvwxyz"
	                          "0123456789-_";
	char *const out = malloc(length + 1);
	for(NSUInteger i = 0; i < length; ++i) out[i] = map[random() & 63];
	out[length] = 0;
	NSString *const str = [NSString stringWithUTF8String:out];
	free(out);
	return str;
}

@implementation SLServerDispatcher

#pragma mark +SLServerDispatcher

+ (void)initialize
{
	if([SLServerDispatcher class] != self) return;
	SLApplicationSupportPath = [[@"~/Library/Application Support/Sequential 3" stringByExpandingTildeInPath] copy];
	SLFilesPath = [[SLApplicationSupportPath stringByAppendingString:@"/Files"] copy];
	SLThumbnailsPath = [[SLApplicationSupportPath stringByAppendingString:@"/Thumbnails"] copy];
	SLIconsPath = [[SLApplicationSupportPath stringByAppendingString:@"/Icons"] copy];
	SLImageExtentions = [[NSSet setWithObjects:@"jpeg", @"jpg", @"png", @"gif", nil] copy];

	NSUserDefaults *const d = [NSUserDefaults standardUserDefaults];
	if(![d objectForKey:SLHashSecretKey]) [d setObject:SLRandomString(40) forKey:SLHashSecretKey];
}

#pragma mark -SLServerDispatcher

- (BOOL)hasValidURLs
{
	return [[NSFileManager defaultManager] fileExistsAtPath:SLFilesPath];
}
- (BOOL)hasCachedThumbnails
{
	return [[NSFileManager defaultManager] fileExistsAtPath:SLThumbnailsPath] || [[NSFileManager defaultManager] fileExistsAtPath:SLIconsPath];
}
- (BOOL)invalidateAllURLsError:(NSError **const)error
{
	[[NSUserDefaults standardUserDefaults] setObject:SLRandomString(40) forKey:SLHashSecretKey];
	return [[NSFileManager defaultManager] removeItemAtPath:SLFilesPath error:error];
}
- (BOOL)clearThumbnailCacheError:(NSError **const)error
{
	return [[NSFileManager defaultManager] removeItemAtPath:SLThumbnailsPath error:error] || [[NSFileManager defaultManager] removeItemAtPath:SLIconsPath error:error];
}

#pragma mark -

- (NSString *)pathForHash:(NSString *const)hash
{
	NSString *const lookupPath = [SLFilesPath stringByAppendingFormat:@"/%@/%@", [hash substringToIndex:2], hash];
	NSData *bookmarkData = [NSData dataWithContentsOfFile:[lookupPath stringByAppendingPathExtension:@"seq-alias"] options:kNilOptions error:NULL];
	if(bookmarkData) return [[NSURL URLByResolvingBookmarkData:bookmarkData options:kNilOptions relativeToURL:nil bookmarkDataIsStale:NULL error:NULL] path];
	bookmarkData = [NSData dataWithContentsOfFile:[lookupPath stringByAppendingString:@"-v1"] options:kNilOptions error:NULL]; // Legacy.
	if(bookmarkData) {
		NSString *const path = [[NSURL URLByResolvingBookmarkData:bookmarkData options:kNilOptions relativeToURL:nil bookmarkDataIsStale:NULL error:NULL] path];
		(void)[self hashForPath:path persistent:YES];
		return path;
	}

	NSString *path = [NSString stringWithContentsOfFile:[lookupPath stringByAppendingPathExtension:@"seq-path"] encoding:NSUTF8StringEncoding error:NULL];
	if(!path) path = [NSString stringWithContentsOfFile:lookupPath encoding:NSUTF8StringEncoding error:NULL]; // Legacy.
	(void)[self hashForPath:path persistent:YES];
	return path;
}
- (NSString *)hashForPath:(NSString *const)path persistent:(BOOL)save
{
	if(!path) return nil;
	Str hashSecret = [[NSUserDefaults standardUserDefaults] objectForKey:SLHashSecretKey];
	uint8_t hashedBytes[SHA_DIGEST_LENGTH] = {};
	char const *const bytes = [[hashSecret stringByAppendingString:path] UTF8String];
	(void)SHA1((unsigned char const *)bytes, strlen(bytes), hashedBytes);
	NSString *const hash = [SLBase64Encode(hashedBytes, 0, SHA_DIGEST_LENGTH) substringToIndex:14];
	if(save) {
		Str dirPath = [SLFilesPath stringByAppendingFormat:@"/%@", [hash substringToIndex:2]];
		(void)[[[[NSFileManager alloc] init] autorelease] createDirectoryAtPath:dirPath withIntermediateDirectories:YES attributes:nil error:NULL];

		NSData *const bookmarkData = [[NSURL fileURLWithPath:path] bookmarkDataWithOptions:NSURLBookmarkCreationMinimalBookmark includingResourceValuesForKeys:nil relativeToURL:nil error:NULL];
		(void)[bookmarkData writeToFile:[dirPath stringByAppendingFormat:@"/%@.seq-alias", hash] options:NSDataWritingAtomic error:NULL];

		(void)[path writeToFile:[dirPath stringByAppendingFormat:@"/%@.seq-path", hash] atomically:YES encoding:NSUTF8StringEncoding error:NULL];
	}
	return hash;
}

#pragma mark -

- (NSDictionary *)infoForFileAtHash:(NSString *const)hash root:(NSString *const)root subpath:(NSString *const)subpath depth:(NSUInteger const)depth fileManager:(NSFileManager *const)fileManager
{
	NSString *const fullpath = [root stringByAppendingString:subpath];
	NSDictionary *const attrs = [fileManager attributesOfItemAtPath:fullpath error:NULL];
	Str const escaped = [(NSString *)CFURLCreateStringByAddingPercentEscapes(kCFAllocatorDefault, (CFStringRef)subpath, NULL, NULL, kCFStringEncodingUTF8) autorelease]; // This should be on par with encodeURI() in JS.
	NSMutableDictionary *const info = [NSMutableDictionary dictionary];
	[info setObject:[fullpath lastPathComponent] forKey:@"name"];
	[info setObject:SLDateToNumber([attrs objectForKey:NSFileCreationDate]) forKey:@"ctime"];
	[info setObject:SLDateToNumber([attrs objectForKey:NSFileModificationDate]) forKey:@"mtime"];
	if(BTEqualObjects(NSFileTypeDirectory, [attrs fileType])) {
		[info setObject:[NSString stringWithFormat:@"/id/%@%@?type=thumb", hash, escaped] forKey:@"thumbURL"];
		if(depth) [info setObject:[self itemsForDirectoryAtHash:hash root:root subpath:subpath depth:depth fileManager:fileManager] forKey:@"items"];
		else [info setObject:[NSString stringWithFormat:@"/id/%@%@?type=index&format=json", hash, escaped] forKey:@"indexURL"];
		return info;
	} else if(BTEqualObjects(NSFileTypeRegular, [attrs fileType])) {
		if(!SLIsImagePath(fullpath)) {
			return nil;
		}
		[info setObject:[attrs objectForKey:NSFileSize] forKey:@"size"];
		[info setObject:[NSString stringWithFormat:@"/id/%@%@?type=image", hash, escaped] forKey:@"imageURL"];
		[info setObject:[NSString stringWithFormat:@"/id/%@%@?type=thumb", hash, escaped] forKey:@"thumbURL"];
		return info;
	}
	return nil;
}
- (NSArray *)itemsForDirectoryAtHash:(NSString *const)hash root:(NSString *const)root subpath:(NSString *const)subpath depth:(NSUInteger const)depth fileManager:(NSFileManager *const)fileManager
{
	NSParameterAssert(depth >= 1);
	NSString *const fullpath = [root stringByAppendingString:subpath];
	NSArray *const files = [fileManager contentsOfDirectoryAtPath:fullpath error:NULL];
	if(![files count]) return [NSArray array];

	Class const fmClass = [fileManager class];
	NSLock *const lock = [[[NSLock alloc] init] autorelease];
	NSMutableArray *const fileIndex = [NSMutableArray array];
	dispatch_apply([files count], dispatch_get_current_queue(), ^(size_t const i) {
		NSString *const thisSubpath = [subpath stringByAppendingFormat:@"/%@", [files objectAtIndex:i]];
		if(![fileManager isVisibleAtPath:[root stringByAppendingString:thisSubpath]]) return;
		NSDictionary *const info = [self infoForFileAtHash:hash root:root subpath:thisSubpath depth:depth-1 fileManager:[[[fmClass alloc] init] autorelease]];
		if(!info) return;
		[lock lock];
		[fileIndex addObject:info];
		[lock unlock];
	});
	return fileIndex;
}

#pragma mark -

- (void)serveReq:(Req)req res:(Res)res
{
	dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^ {
		Str params = [[req URL] parameterString];
		Str path = [[[req URL] path] stringByAppendingString:params ? [@";" stringByAppendingString:params] : @""]; // This is still an ugly hack.
		Arr components = SLComponentsFromPath(path);
		if([components containsObject:@".."]) {
			[self serveUnknownReq:req res:res];
			return;
		}
		[self serveReq:req res:res root:[NSDictionary dictionaryWithObjectsAndKeys:
			path, @"path",
			components, @"components",
			[[[BTFileManager alloc] init] autorelease], @"fileManager",
			nil]];
	});
}
- (void)serveReq:(Req)req res:(Res)res root:(Dic)root
{
	Arr components = [root objectForKey:@"components"];
	SEL const sel = [self next:[components first] selector:_cmd];
	IMPVoid const imp = [self voidMethodForSelector:sel];
	if(!imp) {
		Str path = [_clientPath stringByAppendingPathComponent:[root objectForKey:@"path"]];
		BTFileManager *const fileManager = [root objectForKey:@"fileManager"];
		BOOL isDir = NO;
		(void)[fileManager fileExistsAtPath:path isDirectory:&isDir];
		[res sendFile:isDir ? [path stringByAppendingPathComponent:@"index.html"] : path compressed:YES fileManager:fileManager];
		return;
	}
	imp(self, sel, req, res, root, [NSDictionary dictionaryWithObjectsAndKeys:
		[components rest], @"components",
		nil]);
}
- (void)serveReq:(Req)req res:(Res)res root:(Dic)root id:(Dic)ident
{
	Arr components = [ident objectForKey:@"components"];
	Str hash = [components first];
	Str rootPath = [self pathForHash:hash];
	if(!hash || !rootPath) return [self serveUnknownReq:req res:res];
	Str subPath = SLPathFromComponents([components rest]);
	[self serveReq:req res:res root:root id:ident hash:[NSDictionary dictionaryWithObjectsAndKeys:
		hash, @"hash",
		rootPath, @"rootPath",
		subPath, @"subPath",
		[rootPath stringByAppendingString:subPath], @"path",
		nil]];
}
- (void)serveReq:(Req)req res:(Res)res root:(Dic)root id:(Dic)ident hash:(Dic)hash
{
	Dic query = SLParseQuery([[req URL] query]);
	Str type = [query objectForKey:@"type"];
	if(!type) {
		BTFileManager *const fileManager = [root objectForKey:@"fileManager"];
		return [res sendFile:_galleryPath compressed:YES fileManager:fileManager];
	}
	SEL const sel = [self next:type selector:_cmd];
	IMPVoid const imp = [self voidMethodForSelector:sel];
	if(!imp) return [self serveUnknownReq:req res:res];
	imp(self, sel, req, res, root, ident, hash, [NSDictionary dictionaryWithObjectsAndKeys:
		query, @"query",
		nil]);
}
- (void)serveReq:(Req)req res:(Res)res root:(Dic)root id:(Dic)ident hash:(Dic)hash index:(Dic)index
{
	Str hashString = [hash objectForKey:@"hash"];
	Str rootPath = [hash objectForKey:@"rootPath"];
	Str subPath = [hash objectForKey:@"subPath"];
	BTFileManager *const fileManager = [root objectForKey:@"fileManager"];
	Dic info = [self infoForFileAtHash:hashString root:rootPath subpath:subPath depth:1 fileManager:fileManager];
	[res sendStatus:200 message:@"OK" JSON:info]; // TODO: Check the query for the "format" we're supposed to use.
}
- (void)serveReq:(Req)req res:(Res)res root:(Dic)root id:(Dic)ident hash:(Dic)hash image:(Dic)image
{
	Str path = [hash objectForKey:@"path"];
	if(!SLIsImagePath(path)) return [self serveUnknownReq:req res:res];
	BTFileManager *const fileManager = [root objectForKey:@"fileManager"];
	[res sendFile:path compressed:NO fileManager:fileManager];
}
- (void)serveReq:(Req)req res:(Res)res root:(Dic)root id:(Dic)ident hash:(Dic)hash thumb:(Dic)thumb
{
	BTFileManager *const fileManager = [root objectForKey:@"fileManager"];
	Str path = [hash objectForKey:@"path"];
	SLThumbnailCache *const cache = SLIsImagePath(path) ? _thumbnailCache : _iconCache;
	NSString *const cachePath = [cache cachePathForPath:path fileManager:fileManager];
	if(cachePath) return [res sendFile:cachePath compressed:NO fileManager:fileManager];
	[res sendStatus:500 message:@"Internal Server Error"];
}
- (void)serveUnknownReq:(Req)req res:(Res)res
{
	[res sendStatus:400 message:@"Bad Request"];
}

#pragma mark -

- (void)performAction:(Str)action
{
	Arr components = SLComponentsFromPath(action);
	if([components containsObject:@".."]) return [self performUnknownAction:action];
	SEL const sel = [self next:[components first] selector:_cmd];
	IMPVoid const imp = [self voidMethodForSelector:sel];
	if(!imp) return [self performUnknownAction:action];
	imp(self, sel, action, [NSDictionary dictionaryWithObjectsAndKeys:
		[components rest], @"components",
		nil]);
}
- (void)performAction:(Str)action open:(Dic)open
{
	[[NSDocumentController sharedDocumentController] openDocument:self];
}
- (void)performAction:(Str)action reveal:(Dic)reveal
{
	Arr components = [reveal objectForKey:@"components"];
	SEL const sel = [self next:[components first] selector:_cmd];
	IMPVoid const imp = [self voidMethodForSelector:sel];
	if(!imp) return [self performUnknownAction:action];
	imp(self, sel, action, reveal, [NSDictionary dictionaryWithObjectsAndKeys:
		[components rest], @"components",
		nil]);
}
- (void)performAction:(Str)action reveal:(Dic)reveal id:(Dic)ident
{
	Arr components = [ident objectForKey:@"components"];
	Str hash = [components first];
	Str rootPath = [self pathForHash:hash];
	if(!hash || !rootPath) return [self performUnknownAction:action];
	Str subPath = SLPathFromComponents([components rest]);
	[self performAction:action reveal:reveal id:ident hash:[NSDictionary dictionaryWithObjectsAndKeys:
		hash, @"hash",
		rootPath, @"rootPath",
		subPath, @"subPath",
		[rootPath stringByAppendingString:subPath], @"path",
		nil]];
}
- (void)performAction:(Str)action reveal:(Dic)reveal id:(Dic)ident hash:(Dic)hash
{
	Str path = [[hash objectForKey:@"rootPath"] stringByAppendingString:[hash objectForKey:@"subPath"]];
	BTFileManager *const fileManager = [[[BTFileManager alloc] init] autorelease];
	if([[NSWorkspace sharedWorkspace] selectFile:[fileManager realPathForPath:path] inFileViewerRootedAtPath:nil]) return;
	[self performUnknownAction:action];
}
- (void)performUnknownAction:(Str)action
{
	NSBeep();
}

#pragma mark -NSObject

- (id)init
{
	if((self = [super init])) {
		_clientPath = [[[[NSBundle mainBundle] resourcePath] stringByAppendingPathComponent:@"client"] copy];
		_galleryPath = [[_clientPath stringByAppendingPathComponent:@"gallery/index.html"] copy];
		SLIntegerSize const thumbnailSize = {128, 128};
		_thumbnailCache = [[SLContentThumbnailCache alloc] initWithCachePath:SLThumbnailsPath thumbnailSize:thumbnailSize fileType:NSJPEGFileType properties:[NSDictionary dictionaryWithObjectsAndKeys:
			[NSColor blackColor], NSImageFallbackBackgroundColor,
			[NSNumber numberWithFloat:0.5f], NSImageCompressionFactor,
			nil]];
		_iconCache = [[SLIconThumbnailCache alloc] initWithCachePath:SLIconsPath thumbnailSize:thumbnailSize fileType:NSPNGFileType properties:nil];
	}
	return self;
}
- (void)dealloc
{
	[_clientPath release];
	[_galleryPath release];
	[_thumbnailCache release];
	[_iconCache release];
	[super dealloc];
}

@end
