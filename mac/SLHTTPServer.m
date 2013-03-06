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
#import "SLHTTPServer.h"
#import <sys/socket.h>

#import "JSONKit.h"

#import "BTErrno.h"

static NSDictionary *SLMIMETypes = nil;

@implementation SLEventEmitter

#pragma mark -SLEventEmitter

- (void)addListener:(NSString *const)event block:(void (^ const)())block
{
	if(!_listeners) _listeners = [[NSMutableDictionary alloc] init];
	NSMutableArray *listeners = [_listeners objectForKey:event];
	if(!listeners) {
		listeners = [NSMutableArray array];
		[_listeners setObject:listeners forKey:event];
	}
	[listeners addObject:[[block copy] autorelease]];
}
- (void)removeListener:(NSString *const)event block:(void (^ const)())block
{
	[[_listeners objectForKey:event] removeObjects:block];
}
- (NSArray *)listeners:(NSString *const)event
{
	return [[[_listeners objectForKey:event] copy] autorelease] ?: [NSArray array];
}

#pragma mark -NSObject

- (void)dealloc
{
	[_listeners release];
	[super dealloc];
}

@end

@interface SLHTTPRequest(Private)

- (void)_emitData:(NSData *const)data;
- (void)_emitEnd;

@end

@implementation SLHTTPRequest

#pragma mark -SLHTTPRequest

- (id)initWithRequest:(CFHTTPMessageRef const)req
{
	NSParameterAssert(req);
	NSParameterAssert(CFHTTPMessageIsRequest(req));
	if((self = [super init])) {
		_req = (CFHTTPMessageRef)CFRetain(req);
	}
	return self;
}
- (NSString *)valueForHeader:(NSString *const)header
{
	return [(NSString *)CFHTTPMessageCopyHeaderFieldValue(_req, (CFStringRef)header) autorelease];
}
- (NSString *)method
{
	return [(NSString *)CFHTTPMessageCopyRequestMethod(_req) autorelease];
}
- (NSURL *)URL
{
	return [(NSURL *)CFHTTPMessageCopyRequestURL(_req) autorelease];
}

#pragma mark -SLHTTPRequest(Private)

- (void)_emitData:(NSData *const)data
{
	for(void (^const listener)(NSData *) in [self listeners:@"data"]) listener(data);
}
- (void)_emitEnd
{
	for(void (^const listener)(void) in [self listeners:@"end"]) listener();
}

#pragma mark -NSObject

- (void)dealloc
{
	CFRelease(_req);
	[super dealloc];
}

@end

@interface SLHTTPResponse(Private)

- (void)_writeHeaders;
- (void)_writeData:(NSData *const)data;
- (void)_writeString:(NSString *const)string;

@end

@implementation SLHTTPResponse

#pragma mark +NSObject

+ (void)initialize
{
	if(!SLMIMETypes) SLMIMETypes = [[NSDictionary dictionaryWithContentsOfFile:[[NSBundle mainBundle] pathForResource:@"SLMIMETypes" ofType:@"plist"]] copy];
}

#pragma mark -SLHTTPResponse

- (id)initWithRequest:(SLHTTPRequest *const)req fileDescriptor:(int const)fd
{
	if((self = [super init])) {
		_req = [req retain];
		_fd = fd;
	}
	return self;
}
- (BOOL)shouldSendBody
{
	return !BTEqualObjects(@"head", [[_req method] lowercaseString]);
}
- (void)writeStatus:(NSUInteger const)status message:(NSString *const)message
{
	[self _writeString:[NSString stringWithFormat:@"HTTP/1.1 %lu %@\r\n", status, message]];
}
- (void)writeHeader:(NSString *const)key value:(NSString *const)value
{
	[self _writeString:[NSString stringWithFormat:@"%@: %@\r\n", key, value]];
}
- (void)writeContentLength:(unsigned long long const)length
{
	[self writeHeader:@"Content-Length" value:[NSString stringWithFormat:@"%qu", length]];
}
- (void)write:(NSData *const)data
{
	[self _writeHeaders];
	if(data && [self shouldSendBody]) [self _writeData:data];
}
- (void)end:(NSData *const)data
{
	[self write:data];
	(void)close(_fd);
	_fd = -1;
}
- (void)end
{
	[self end:nil];
}

#pragma mark -

- (void)sendStatus:(NSUInteger const)status message:(NSString *const)message
{
	[self writeStatus:status message:message];
	[self writeHeader:@"Content-Type" value:@"text/plain; charset=utf-8"];
	[self end:[message dataUsingEncoding:NSUTF8StringEncoding]];
}
- (void)sendStatus:(NSUInteger const)status message:(NSString *const)message JSON:(id const)obj
{
	NSData *const data = [obj JSONData];
	if(!data) return [self sendStatus:500 message:@"Internal Server Error"];
	[self writeStatus:status message:message];
	[self writeHeader:@"Content-Type" value:@"text/json; charset=utf-8"];
	[self writeContentLength:[data length]];
	[self end:data];
}
- (void)sendFile:(NSString *const)path compressed:(BOOL const)compressed fileManager:(NSFileManager *const)fileManager
{
	// TODO: Check to see if _req accepts gzip. Realistically, every browser we care about does.
	NSString *const gzPath = compressed ? [path stringByAppendingPathExtension:@"gz"] : nil;
	BOOL const gz = compressed && [fileManager fileExistsAtPath:gzPath];
	if(!gz && ![fileManager fileExistsAtPath:path]) return [self sendStatus:404 message:@"Not Found"];
	NSString *const fullpath = gz ? gzPath : path;

	[self writeStatus:200 message:@"OK"];
	NSString *const ext = [path pathExtension];
	if(BTEqualObjects(@"", ext)) { // Hack for our LICENSE files.
		[self writeHeader:@"Content-Disposition" value:@"inline"];
		[self writeHeader:@"Content-Type" value:@"text/plain; charset=utf-8"];
	} else {
		[self writeHeader:@"Content-Type" value:[SLMIMETypes objectForKey:[ext lowercaseString]] ?: @"application/octet-stream"];
	}
	NSNumber *const contentLength = [[fileManager attributesOfItemAtPath:fullpath error:NULL] objectForKey:NSFileSize];
	if(contentLength) [self writeContentLength:[contentLength unsignedLongLongValue]];
	if(gz) [self writeHeader:@"Content-Encoding" value:@"gzip"];
	[self _writeHeaders];
	if([self shouldSendBody]) [fileManager sendFileAtPath:fullpath toSocket:_fd];
	[self end];
}
- (void)sendError:(NSError *const)error
{
	NSString *const domain = [error domain];
	if(BTEqualObjects(NSPOSIXErrorDomain, domain)) return [self sendErrno:(int)[error code]];
	if(BTEqualObjects(NSCocoaErrorDomain, domain)) {
		NSString *const path = [[error userInfo] objectForKey:NSFilePathErrorKey];
		if(path && 2 == [error code]) return [self sendStatus:404 message:@"Not Found"];
	}
	NSLog(@"Unknown error domain %@, %ld, %@", domain, (long)[error code], [error userInfo]);
	[self sendStatus:500 message:@"Internal Server Error"];
}
- (void)sendErrno:(int const)code
{
	switch(code) {
		case ENOENT: return [self sendStatus:404 message:@"Not Found"];
	}
	NSLog(@"Unknown error code %@", BTErrnoToString(code));
	[self sendStatus:500 message:@"Internal Server Error"];
}

#pragma mark -SLHTTPResponse(Private)

- (void)_writeHeaders
{
	if(_sentHeaders) return;
	[self writeHeader:@"Connection" value:@"close"];
	[self _writeString:@"\r\n"];
	_sentHeaders = YES;
}
- (void)_writeData:(NSData *const)data
{
	if(!data) return;
	BTErrno(write(_fd, [data bytes], [data length]));
}
- (void)_writeString:(NSString *const)string
{
	[self _writeData:[string dataUsingEncoding:NSUTF8StringEncoding]];
}

#pragma mark -NSObject

- (void)dealloc
{
	if(-1 != _fd) [self end];
	[_req release];
	[super dealloc];
}

@end

@interface SLHTTPServer(Private)

- (void)_accept:(NSSocketNativeHandle const)fd;

@end

static void SLAccept(CFSocketRef const s, CFSocketCallBackType const type, NSData *const address, NSSocketNativeHandle *const socket, SLHTTPServer *const server)
{
	NSCParameterAssert(kCFSocketAcceptCallBack == type);
	[server _accept:*socket];
}

@implementation SLHTTPServer

#pragma mark -SLHTTPServer

- (void)listenOnPort:(in_port_t const)port address:(in_addr_t const)address
{
	NSAssert(!_socket, @"Already listening");

	CFSocketContext const context = {
		.version = 0,
		.info = self,
	};
	_socket = CFSocketCreate(kCFAllocatorDefault, PF_INET, SOCK_STREAM, IPPROTO_TCP, kCFSocketAcceptCallBack, (CFSocketCallBack)SLAccept, &context);
	if(!_socket) return;

	int const yes = YES;
	setsockopt(CFSocketGetNative(_socket), SOL_SOCKET, SO_REUSEADDR, &yes, sizeof(yes));

	struct sockaddr_in const addr = {
		.sin_len = sizeof(addr),
		.sin_family = AF_INET,
		.sin_port = htons(port),
		.sin_addr = {
			.s_addr = htonl(address),
		},
	};
	NSData *const addrData = [NSData dataWithBytes:&addr length:sizeof(addr)];
	CFSocketSetAddress(_socket, (CFDataRef)addrData);

	_source = CFSocketCreateRunLoopSource(kCFAllocatorDefault, _socket, 0);
	CFRunLoopAddSource(CFRunLoopGetCurrent(), _source, kCFRunLoopCommonModes);
}
- (void)close
{
	if(_source) {
		CFRunLoopSourceInvalidate(_source);
		CFRelease(_source);
		_source = NULL;
	}
	if(_socket) {
		CFSocketInvalidate(_socket);
		CFRelease(_socket);
		_socket = NULL;
	}
}

#pragma mark -SLHTTPServer

- (void)_accept:(NSSocketNativeHandle const)fd
{
	int const yes = YES;
	BTErrno(setsockopt(fd, SOL_SOCKET, SO_NOSIGPIPE, &yes, sizeof(yes)));
//	BTErrno(setsockopt(fd, SOL_SOCKET, SO_KEEPALIVE, &yes, sizeof(yes)));
	// TODO: Implement keep-alive.

	dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, kNilOptions), ^ {
		CFHTTPMessageRef const msg = (CFHTTPMessageRef)[(id)CFHTTPMessageCreateEmpty(kCFAllocatorDefault, true) autorelease];
		SLHTTPRequest *const req = [[[SLHTTPRequest alloc] initWithRequest:msg] autorelease];
		SLHTTPResponse *const res = [[[SLHTTPResponse alloc] initWithRequest:req fileDescriptor:fd] autorelease];
		NSUInteger const bufferLength = 1024 * 10;
		NSMutableData *const data = [NSMutableData dataWithLength:bufferLength];
		uint8_t *const bytes = [data mutableBytes];
		BOOL readingHeader = YES;
		for(;;) {
			ssize_t const length = recv(fd, bytes, bufferLength, kNilOptions);
			if(-1 == length && EBADF == errno) break; // Closed by client?
			BTErrno(length);
			if(length <= 0) break;
			if(readingHeader) {
				CFHTTPMessageAppendBytes(msg, bytes, (CFIndex)length);
				if(!CFHTTPMessageIsHeaderComplete(msg)) continue;
				readingHeader = NO;
				dispatch_async(dispatch_get_main_queue(), ^ {
					for(void (^const listener)(SLHTTPRequest *, SLHTTPResponse *) in [self listeners:@"request"]) listener(req, res);
					[req _emitData:[(NSData *)CFHTTPMessageCopyBody(msg) autorelease]];
				});
			} else {
				dispatch_async(dispatch_get_main_queue(), ^ {
					[req _emitData:[data subdataWithRange:NSMakeRange(0, length)]];
				});
			}
		}
		dispatch_async(dispatch_get_main_queue(), ^ {
			[req _emitEnd];
			// Do NOT close the fd. That happens in -[res end].
		});
	});
}

#pragma mark -NSObject

- (void)dealloc
{
	[self close];
	[super dealloc];
}

@end
