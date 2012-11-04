/* Comparison of numeric ("natural") string sort algorithms.
Example output order: ["file9", "file10"]
Some have bugs or disagree on exact order.

Sample output (using real-life filenames from my desktop):

Items: 171
compare1 2930
compare2 8363
compare3 3961
compare4 29811
compare5 1474
compareMine 1131
compareOld 1383
*/
var data = require("./sort-data"); // Should be a JSON array.
console.log("Items: "+data.length);

// <http://stackoverflow.com/a/6020316>
function compare1(as, bs){
    var a, b, a1, b1, i= 0, L, rx=  /(\d+)|(\D+)/g, rd=  /\d/;
    if(isFinite(as) && isFinite(bs)) return as - bs;
    a= as;//String(as).toLowerCase();
    b= bs;//String(bs).toLowerCase();
    if(a=== b) return 0;
    if(!(rd.test(a) && rd.test(b))) return a> b? 1: -1;
    a= a.match(rx);
    b= b.match(rx);
    L= a.length> b.length? b.length: a.length;
    while(i < L){
        a1= a[i];
        b1= b[i++];
        if(a1!== b1){
            if(isFinite(a1) && isFinite(b1)){
                if(a1.charAt(0)=== "0") a1= "." + a1;
                if(b1.charAt(0)=== "0") b1= "." + b1;
                return a1 - b1;
            }
            else return a1> b1? 1: -1;
        }
    }
    return a.length - b.length;
}

// <http://my.opera.com/GreyWyvern/blog/show.dml/1671288>
// Has at least one bug.
function compare2(a, b) {
  function chunkify(t) {
    var tz = [], x = 0, y = -1, n = 0, i, j;

    while (i = (j = t.charAt(x++)).charCodeAt(0)) {
      var m = (i == 46 || (i >=48 && i <= 57));
      if (m !== n) {
        tz[++y] = "";
        n = m;
      }
      tz[y] += j;
    }
    return tz;
  }

  var aa = chunkify(a);
  var bb = chunkify(b);

  for (x = 0; aa[x] && bb[x]; x++) {
    if (aa[x] !== bb[x]) {
      var c = Number(aa[x]), d = Number(bb[x]);
      if (c == aa[x] && d == bb[x]) {
        return c - d;
      } else return (aa[x] > bb[x]) ? 1 : -1;
    }
  }
  return aa.length - bb.length;
}

// <http://snipplr.com/view/36012/javascript-natural-sort/>
function compare3(as, bs) {
    var a, b, a1, b1, rx=/(\d+)|(\D+)/g, rd=/\d+/;
    a= /*String(as).toLowerCase()*/as.match(rx);
    b= /*String(bs).toLowerCase()*/bs.match(rx);
    while(a.length && b.length){
        a1= a.shift();
        b1= b.shift();
        if(rd.test(a1) || rd.test(b1)){
            if(!rd.test(a1)) return 1;
            if(!rd.test(b1)) return -1;
            if(a1!= b1) return a1-b1;
        }
        else if(a1!= b1) return a1> b1? 1: -1;
    }
    return a.length- b.length;
}

// <http://stackoverflow.com/a/6447130>
function compare4(a, b) {
    function prepare(s) {
        var q = [];
        s.replace(/(\D)|(\d+)/g, function($0, $1, $2) {
            q.push($1 ? 1 : 2);
            q.push($1 ? $1.charCodeAt(0) : Number($2) + 1)
        });
        q.push(0);
        return q;
    }
    var aa = prepare(a), bb = prepare(b), i = 0;
    do {
        if(aa[i] != bb[i])
            return aa[i] - bb[i];
    } while(aa[i++] > 0);
    return 0;
}

// <http://stackoverflow.com/a/2802804>
// Has at least one bug.
function compare5(a, b){
    var cnt= 0, tem;
    //a= String(a).toLowerCase();
    //b= String(b).toLowerCase();
    if(a== b) return 0;
    if(/\d/.test(a) ||  /\d/.test(b)){
        var Rx=  /^\d+(\.\d+)?/;
        while(a.charAt(cnt)=== b.charAt(cnt) && 
        !Rx.test(a.substring(cnt))){
            cnt++;
        }
        a= a.substring(cnt);
        b= b.substring(cnt);
        if(Rx.test(a) || Rx.test(b)){
            if(!Rx.test(a)) return a? 1: -1;
            if(!Rx.test(b)) return b? -1: 1;
            tem= parseFloat(a)-parseFloat(b);
            if(tem!= 0) return tem;
            a= a.replace(Rx,'');
            b= b.replace(Rx,'');
            if(/\d/.test(a) ||  /\d/.test(b)){
                return compare5(a, b);
            }
        }
    }
    if(a== b) return 0;
    return a> b? 1: -1;
}

// Mine.
function compareMine(a1, b1) {
	var ra = /(\D*)(\d*)/g;
	var rb = /(\D*)(\d*)/g;
	var a2, b2, r;
	for(;;) {
		a2 = ra.exec(a1);
		b2 = rb.exec(b1);
		if(!a2 && !b2) return 0;
		if(!a2) return -1;
		if(!b2) return 1;
		if(a2[1].length !== b2[1].length) return a2[0].localeCompare(b2[0]);
		r = a2[1].localeCompare(b2[1]) || (+a2[2]-b2[2]);
		if(r) return r;
	}
};

// Mine (old).
function compareOld(a, b) {
	//a = a.toLocaleLowerCase();
	//b = b.toLocaleLowerCase();
	var ca, cb, diff;
	function numeric(c) {
		return c >= "0" && c <= "9";
	}
	for(var i = 0, j = 0; i < a.length && j < b.length; ++i, ++j) {
		ca = a[i];
		cb = b[j]; // TODO: Even better, just keep track of the positions and use .slice()
		if(numeric(ca) && numeric(cb)) {
			for(ca = [ca]; numeric(a[i + 1]); ++i) ca.push(a[i + 1]);
			for(cb = [cb]; numeric(b[j + 1]); ++j) cb.push(b[j + 1]);
			diff = parseInt(ca.join(""), 10) - parseInt(cb.join(""), 10);
		} else {
			diff = ca.localeCompare(cb);
		}
		if(diff) return diff;
	}
	return (a.length - i) - (b.length - j);
};

function test(func) {
	var a = +new Date;
	for(var i = 0; i < 1000; ++i) data.slice().sort(func);
	var b = +new Date;
	console.log(func.name, b-a);
}
test(compare1);
test(compare2);
test(compare3);
//test(compare4); // Slowest by far.
test(compare5);
test(compareMine);
test(compareOld);
