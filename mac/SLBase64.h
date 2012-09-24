// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

static const char *const base64_table = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                                        "abcdefghijklmnopqrstuvwxyz"
                                        "0123456789-_"; // Had to change +/ to -_ for our purposes in URLs.

static NSString *SLBase64Encode(uint8_t const *const data, int const start, int const end)
{
	int n = end - start;
	int out_len = (n + 2 - ((n + 2) % 3)) / 3 * 4;
	char *out = malloc(out_len + 1);

	uint8_t bitbuf[3];
	int i = start; // data() index
	int j = 0; // out index
	char c;
	bool b1_oob, b2_oob;

	while (i < end) {
		bitbuf[0] = data[i++];

		if (i < end) {
			bitbuf[1] = data[i];
			b1_oob = false;
		}	else {
			bitbuf[1] = 0;
			b1_oob = true;
		}
		i++;

		if (i < end) {
			bitbuf[2] = data[i];
			b2_oob = false;
		}	else {
			bitbuf[2] = 0;
			b2_oob = true;
		}
		i++;


		c = bitbuf[0] >> 2;
		assert(c < 64);
		out[j++] = base64_table[(int)c];
		assert(j < out_len);

		c = ((bitbuf[0] & 0x03) << 4) | (bitbuf[1] >> 4);
		assert(c < 64);
		out[j++] = base64_table[(int)c];
		assert(j < out_len);

		if (b1_oob) {
			out[j++] = '=';
		} else {
			c = ((bitbuf[1] & 0x0F) << 2) | (bitbuf[2] >> 6);
			assert(c < 64);
			out[j++] = base64_table[(int)c];
		}
		assert(j < out_len);

		if (b2_oob) {
			out[j++] = '=';
		} else {
			c = bitbuf[2] & 0x3F;
			assert(c < 64);
			out[j++] = base64_table[(int)c];
		}
		assert(j <= out_len);
	}

	out[out_len] = 0;
	return [[[NSString alloc] initWithBytesNoCopy:out length:out_len encoding:NSASCIIStringEncoding freeWhenDone:YES] autorelease];
}
