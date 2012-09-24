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
#import "SLDispatcher.h"

@class SLThumbnailCache;
@class SLHTTPServer;
@class SLHTTPRequest;
@class SLHTTPResponse;

typedef NSDictionary *const Dic;
typedef NSString *const Str;
typedef NSArray *const Arr;
typedef NSUInteger Idx;
typedef NSUInteger const Len;
typedef SLHTTPRequest *const Req;
typedef SLHTTPResponse *const Res;

@interface SLServerDispatcher : SLDispatcher
{
	@private
	NSString *_clientPath;
	NSString *_indexPath;
	SLThumbnailCache *_thumbnailCache;
	SLThumbnailCache *_iconCache;
}

- (BOOL)hasValidURLs;
- (BOOL)hasCachedThumbnails;
- (BOOL)invalidateAllURLsError:(NSError **const)error;
- (BOOL)clearThumbnailCacheError:(NSError **const)error;

- (NSString *)pathForHash:(NSString *const)hash;
- (NSString *)hashForPath:(NSString *const)path persistent:(BOOL)save;

- (NSDictionary *)infoForFileAtHash:(NSString *const)hash root:(NSString *const)root subpath:(NSString *const)subpath depth:(NSUInteger const)depth fileManager:(NSFileManager *const)fileManager;
- (NSArray *)itemsForDirectoryAtHash:(NSString *const)hash root:(NSString *const)root subpath:(NSString *const)subpath depth:(NSUInteger const)depth fileManager:(NSFileManager *const)fileManager;

- (void)serveReq:(Req)req res:(Res)res;
- (void)serveReq:(Req)req res:(Res)res root:(Dic)root;
- (void)serveReq:(Req)req res:(Res)res root:(Dic)root id:(Dic)ident;
- (void)serveReq:(Req)req res:(Res)res root:(Dic)root id:(Dic)ident hash:(Dic)hash;
- (void)serveReq:(Req)req res:(Res)res root:(Dic)root id:(Dic)ident hash:(Dic)hash index:(Dic)index;
- (void)serveReq:(Req)req res:(Res)res root:(Dic)root id:(Dic)ident hash:(Dic)hash image:(Dic)image;
- (void)serveReq:(Req)req res:(Res)res root:(Dic)root id:(Dic)ident hash:(Dic)hash thumb:(Dic)thumb;
- (void)serveUnknownReq:(Req)req res:(Res)res;

- (void)performAction:(Str)action;
- (void)performAction:(Str)action open:(Dic)open;
- (void)performAction:(Str)action reveal:(Dic)reveal;
- (void)performAction:(Str)action reveal:(Dic)reveal id:(Dic)ident;
- (void)performAction:(Str)action reveal:(Dic)reveal id:(Dic)ident hash:(Dic)hash;
- (void)performUnknownAction:(Str)action;

@end
