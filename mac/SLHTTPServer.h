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
#import <netinet/in.h>

@interface SLEventEmitter : NSObject
{
	@private
	NSMutableDictionary *_listeners;
}

- (void)addListener:(NSString *const)event block:(void (^ const)())block;
- (void)removeListener:(NSString *const)event block:(void (^ const)())block;
- (NSArray *)listeners:(NSString *const)event;

@end

@interface SLHTTPRequest : SLEventEmitter // Emits data(NSData *), end().
{
	@private
	CFHTTPMessageRef _req;
}

- (id)initWithRequest:(CFHTTPMessageRef const)req;
- (NSString *)valueForHeader:(NSString *const)header;
- (NSString *)method;
- (NSURL *)URL;

@end

@interface SLHTTPResponse : NSObject
{
	@private
	SLHTTPRequest *_req;
	int _fd;
	BOOL _sentHeaders;
}

- (id)initWithRequest:(SLHTTPRequest *const)req fileDescriptor:(int const)fd;
- (BOOL)shouldSendBody;
- (void)writeStatus:(NSUInteger const)status message:(NSString *const)message;
- (void)writeHeader:(NSString *const)key value:(NSString *const)value;
- (void)writeContentLength:(unsigned long long const)length;
- (void)write:(NSData *const)data;
- (void)end:(NSData *const)data;
- (void)end;

- (void)sendStatus:(NSUInteger const)status message:(NSString *const)message;
- (void)sendStatus:(NSUInteger const)status message:(NSString *const)message JSON:(id const)obj;
- (void)sendFile:(NSString *const)path compressed:(BOOL const)compressed fileManager:(NSFileManager *const)fileManager;
- (void)sendError:(NSError *const)error;
- (void)sendErrno:(int const)code;

@end

@interface NSFileManager(SLRequiredForHTTPResponse) // Defined by BTFileManager.

- (BOOL)sendFileAtPath:(NSString *const)path toSocket:(int const)socket;

@end

@interface SLHTTPServer : SLEventEmitter // Emits request(SLHTTPRequest *, SLHTTPResponse *).
{
	@private
	CFSocketRef _socket;
	CFRunLoopSourceRef _source;
}

- (void)listenOnPort:(in_port_t const)port address:(in_addr_t const)address;
- (void)close;

@end
