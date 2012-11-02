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
var DOM = {
    clone: function(id, childByID) {
        var element = document.getElementById(id).cloneNode(true);
        //element.id = "";
        element.removeAttribute("id");
        if (childByID)
            (function findIDsInElement(elem) {
                var children = elem.childNodes, length = children.length, i = 0, dataID;
                if (elem.getAttribute)
                    dataID = elem.getAttribute("data-id");
                if (dataID)
                    childByID[dataID] = elem;
                for (; i < length; ++i)
                    findIDsInElement(children[i]);
            })(element);
        return element;
    },
    classify: function(elem, className, add) {
        if (add || undefined === add) {
            elem.className += " "+className;
            return;
        }
        var classes = (elem.className || "").split(" "), 
        changed = (className || "").split(" "), 
        length = changed.length, i = 0, index;
        for (; i < length; ++i) {
            index = classes.indexOf(changed[i]);
            if (index >= 0)
                classes.splice(index, 1);
        }
        elem.className = classes.join(" ");
    },
    fill: function(elem, child1, child2, etc) {
        var i = 1, type;
        while (elem.hasChildNodes())
            elem.removeChild(elem.firstChild);
        for (; i < arguments.length; ++i)
            if (arguments[i]) {
                type = typeof arguments[i];
                if ("string" === type || "number" === type) {
                    elem.appendChild(document.createTextNode(arguments[i]));
                } else {
                    elem.appendChild(arguments[i]);
                }
            }
    },
    remove: function(elem) {
        if (elem.parentNode)
            elem.parentNode.removeChild(elem);
    },
    addListener: function(elem, name, func) {
        if(elem.addEventListener) elem.addEventListener(name, func);
        else elem.attachEvent("on"+name, func);
    },
    removeListener: function(elem, name, func) {
        if(elem.removeEventListener) elem.removeEventListener(name, func);
        else elem.detachEvent("on"+name, func);
    }
};
