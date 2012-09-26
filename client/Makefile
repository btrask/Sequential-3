ifndef CLIENT_BUILD_DIR
	abort
	#CLIENT_BUILD_DIR := build
endif
ifndef INSTALL_DIR
	abort
	#INSTALL_DIR := install
endif
ifndef CONFIG_PATH
	CONFIG_PATH := config.js
endif

SCRIPTS := external/json2.js \
           utilities/bt.js \
           utilities/sort.js \
           utilities/DOM.js \
           utilities/Geometry.js \
           classes/Uploader.js \
           classes/Menu.js \
           classes/ReadingDirection.js \
           classes/Scaler.js \
           classes/Scroller.js \
           classes/ScrollView.js \
           classes/Node.js \
           classes/ThumbnailBrowser.js \
           classes/Index.js \
           $(CONFIG_PATH) \
           index.js

FILES := index.html \
         index.css \
         index.js \
         robots.txt \
         favicon.ico \
         folder.png \
         error.png \
         background.png

FILES_GZ := $(addsuffix .gz,$(FILES))

all: gzip

gzip: $(addprefix $(CLIENT_BUILD_DIR)/,$(FILES)) $(addprefix $(CLIENT_BUILD_DIR)/,$(FILES_GZ))

install: $(addprefix $(INSTALL_DIR)/,$(FILES_GZ))

clean:
	-rm -rf $(CLIENT_BUILD_DIR)
	-rm -rf $(INSTALL_DIR)

$(CLIENT_BUILD_DIR)/index.js: $(SCRIPTS)
	-mkdir -p $(dir $@)
	java -jar ../deps/compiler-latest/compiler.jar $(addprefix --js=,$+) --js_output_file=$@ --language_in=ECMASCRIPT5 $(CLOSURE_FLAGS)

$(CLIENT_BUILD_DIR)/%.css: %.css
	-mkdir -p $(dir $@)
	cat $+ | java -jar ../deps/yuicompressor-2.4.2/build/yuicompressor-2.4.2.jar --type css --charset utf-8 -o $@

$(CLIENT_BUILD_DIR)/%: %
	-mkdir -p $(dir $@)
	cp -R $< $@

$(CLIENT_BUILD_DIR)/%.gz: $(CLIENT_BUILD_DIR)/%
	-mkdir -p $(dir $@)
	gzip -nc9 $< > $@

$(INSTALL_DIR)/%.gz: $(CLIENT_BUILD_DIR)/%.gz
	-mkdir -p $(dir $@)
	cp $< $@

Debug_: install
Release_: install
Release_clean: clean
Debug_clean: clean

.PHONY: all gzip install clean Debug_ Release_ Release_clean Debug_clean
