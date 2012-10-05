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
#import "SLThumbnailCache.h"
#include <openssl/sha.h>
#include <openssl/bio.h>
#include <openssl/evp.h>

#import "SLAdditions.h"

static NSString *SLExtensionForFileType(NSBitmapImageFileType const t)
{
	switch(t) {
		case NSTIFFFileType: return @"tif";
		case NSBMPFileType: return @"bmp";
		case NSGIFFileType: return @"gif";
		case NSJPEGFileType: return @"jpg";
		case NSPNGFileType: return @"png";
	}
	NSCAssert(0, @"Unknown file type %lu", (unsigned long)t);
	return nil;
}

static NSOperationQueue *SLThumbnailQueue = nil;

@implementation SLThumbnailCache

#pragma mark +SLThumbnailCache

+ (void)initialize
{
	if(!SLThumbnailQueue) {
		SLThumbnailQueue = [[NSOperationQueue alloc] init];
		[SLThumbnailQueue setName:[NSString stringWithFormat:@"%@.SLThumbnailQueue", [[NSBundle mainBundle] bundleIdentifier]];
		[SLThumbnailQueue setMaxConcurrentOperationCount:[[NSProcessInfo processInfo] processorCount] * 2]; // <http://www.mikeash.com/pyblog/friday-qa-2009-09-25-gcd-practicum.html>
	}
}

#pragma mark -SLThumbnailCache

- (id)initWithCachePath:(NSString *const)cachePath thumbnailSize:(SLIntegerSize const)thumbnailSize fileType:(NSBitmapImageFileType const)fileType properties:(NSDictionary *const)properties
{
	NSParameterAssert(![cachePath hasSuffix:@"/"]);
	if((self = [super init])) {
		_cachePath = [cachePath copy];
		_thumbnailSize = thumbnailSize;
		_fileType = fileType;
		_properties = [properties copy];
	}
	return self;
}
- (NSString *)cachePath
{
	return [[_cachePath retain] autorelease];
}
- (SLIntegerSize)thumbnailSize
{
	return _thumbnailSize;
}
- (NSBitmapImageFileType)fileType
{
	return _fileType;
}
- (NSDictionary *)properties
{
	return [[_properties retain] autorelease];
}

#pragma mark -

- (NSString *)cachePathForPath:(NSString *const)path fileManager:(NSFileManager *const)fileManager
{
	NSString *const hash = [self hashForPath:path];
	NSString *const cachePath = [_cachePath stringByAppendingFormat:@"/%@/%@.%@", [hash substringToIndex:2], hash, SLExtensionForFileType(_fileType)];
	NSDictionary *const cacheAttrs = [fileManager attributesOfItemAtPath:cachePath error:NULL];
	if(cacheAttrs) {
		NSDictionary *const fileAttrs = [fileManager attributesOfItemAtPath:path error:NULL];
		NSDate *const cacheDate = [cacheAttrs objectForKey:NSFileModificationDate] ?: [cacheAttrs objectForKey:NSFileCreationDate];
		NSDate *const fileDate = [fileAttrs objectForKey:NSFileModificationDate] ?: [fileAttrs objectForKey:NSFileCreationDate];
		if([cacheDate timeIntervalSinceReferenceDate] > [fileDate timeIntervalSinceReferenceDate]) return cachePath;
	}
	NSData *const data = [self thumbnailDataForPath:path fileManager:fileManager];
	if(!data) return nil;
	if(![fileManager createDirectoryAtPath:[cachePath stringByDeletingLastPathComponent] withIntermediateDirectories:YES attributes:nil error:NULL]) return nil;
	if(![data writeToFile:cachePath options:NSDataWritingAtomic error:NULL]) return nil;
	return cachePath;
}

#pragma mark -

- (NSString *)hashForPath:(NSString *const)path
{
	uint8_t hashedBytes[SHA_DIGEST_LENGTH] = {};
	char const *const bytes = [[path stringByAppendingFormat:@"[%ld,%ld]", (long)_thumbnailSize.width, (long)_thumbnailSize.height] UTF8String]; // We don't need to put the _fileType in the hash because we use file extensions.
	(void)SHA1((unsigned char const *)bytes, strlen(bytes), hashedBytes);
	return SLHexEncode(hashedBytes, SHA_DIGEST_LENGTH);
}
- (NSData *)thumbnailDataForPath:(NSString *const)path fileManager:(NSFileManager *const)fileManager
{
	__block NSData *result = nil;
	NSOperation *const op = [NSBlockOperation blockOperationWithBlock:^ {
		NSAutoreleasePool *const pool = [[NSAutoreleasePool alloc] init];
		NSImage *const image = [self imageForPath:path fileManager:fileManager];
		if(!image) return;
		NSImageRep *const srcRep = [image bestRepresentationForRect:NSZeroRect context:nil hints:nil];
		NSSize const src = NSMakeSize([srcRep pixelsWide], [srcRep pixelsHigh]);
		CGFloat const scale = MIN(1.0, MIN((CGFloat)_thumbnailSize.width / src.width, (CGFloat)_thumbnailSize.height / src.height));
		NSSize const dst = NSMakeSize(round(src.width * scale), round(src.height * scale));
		[image setSize:dst];
		[image lockFocusOnRepresentation:srcRep];
		NSBitmapImageRep *const dstRep = [[[NSBitmapImageRep alloc] initWithFocusedViewRect:NSMakeRect(0, 0, dst.width, dst.height)] autorelease];
		[image unlockFocus];
		result = [[dstRep representationUsingType:_fileType properties:_properties] retain];
		[pool drain];
	}];
	[SLThumbnailQueue addOperation:op];
	[op waitUntilFinished];
	return [result autorelease];
}

#pragma mark SLThumbnailCache(SLAbstract)

- (NSImage *)imageForPath:(NSString *const)path fileManager:(NSFileManager *const)fileManager
{
	NSAssert(0, @"SLThumbnailCache is abstract, use SLContentThumbnailCache or SLIconThumbnailCache instead.");
	return nil;
}

#pragma mark -NSObject

- (void)dealloc
{
	[_cachePath release];
	[_properties release];
	[super dealloc];
}

@end

@implementation SLContentThumbnailCache

#pragma mark SLThumbnailCache(SLAbstract)

- (NSImage *)imageForPath:(NSString *const)path fileManager:(NSFileManager *const)fileManager
{
	return [[[NSImage alloc] initWithData:[fileManager contentsAtPath:path options:NSDataReadingUncached error:NULL]] autorelease];
}

@end

@implementation SLIconThumbnailCache

#pragma mark SLThumbnailCache(SLAbstract)

- (NSImage *)imageForPath:(NSString *const)path fileManager:(NSFileManager *const)fileManager
{
	return [fileManager iconForPath:path];
}

@end
