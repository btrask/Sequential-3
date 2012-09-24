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
typedef struct {
	NSInteger width;
	NSInteger height;
} SLIntegerSize;

@interface SLThumbnailCache : NSObject
{
	@private
	NSString *_cachePath;
	SLIntegerSize _thumbnailSize;
	NSBitmapImageFileType _fileType;
	NSDictionary *_properties;
}

- (id)initWithCachePath:(NSString *const)cachePath thumbnailSize:(SLIntegerSize const)thumbnailSize fileType:(NSBitmapImageFileType const)fileType properties:(NSDictionary *const)properties;
- (NSString *)cachePath;
- (SLIntegerSize)thumbnailSize;
- (NSBitmapImageFileType)fileType;
- (NSDictionary *)properties;

- (NSString *)cachePathForPath:(NSString *const)path fileManager:(NSFileManager *const)fileManager;

- (NSString *)hashForPath:(NSString *const)path;
- (NSData *)thumbnailDataForPath:(NSString *const)path fileManager:(NSFileManager *const)fileManager;

@end

@interface SLThumbnailCache(SLAbstract)

- (NSImage *)imageForPath:(NSString *const)path fileManager:(NSFileManager *const)fileManager;

@end

@interface SLContentThumbnailCache : SLThumbnailCache
@end

@interface SLIconThumbnailCache : SLThumbnailCache
@end

@interface NSFileManager(SLRequiredForThumbnailCache) // Defined by BTFileManager.

- (NSImage *)iconForPath:(NSString *const)path;

@end
