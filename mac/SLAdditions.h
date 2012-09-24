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
static NSString *SLDisplayName(NSString *const str)
{
	NSString *displayName = nil;
	if(LSCopyDisplayNameForURL((CFURLRef)[NSURL URLWithString:str], (CFStringRef *)&displayName) == noErr && displayName) return [displayName autorelease];
	return [[NSFileManager defaultManager] displayNameAtPath:str];
}
static NSString *SLHexEncode(uint8_t const *const restrict bytes, NSUInteger const l)
{
	char const *const restrict chars = "0123456789abcdef";
	char *const restrict hex = malloc(l * 2);
	for(NSUInteger i = 0; i < l; ++i) {
		uint8_t const byte = bytes[i];
		hex[i * 2] = chars[byte >> 4];
		hex[i * 2 + 1] = chars[byte & 0xf];
	}
	return [[[NSString alloc] initWithBytesNoCopy:hex length:l * 2 encoding:NSASCIIStringEncoding freeWhenDone:YES] autorelease];
}

@interface NSArray(SLAdditions)

- (id)first;
- (NSArray *)rest;

@end
