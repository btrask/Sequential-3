ifndef ROOT_DIR
	ROOT_DIR := ..
endif
ifndef CLIENT_BUILD_DIR
	CLIENT_BUILD_DIR := build
endif
ifndef CONFIG_PATH
	CONFIG_PATH := gallery/config.js
endif

CLIENT_SCRIPTS := \
	gallery/external/json2.js \
	gallery/external/Array.js \
	gallery/external/setZeroTimeout.js \
	gallery/utilities/bt.js \
	gallery/utilities/sort.js \
	gallery/utilities/DOM.js \
	gallery/utilities/Geometry.js \
	gallery/utilities/KBD.js \
	gallery/utilities/env.js \
	gallery/classes/Menu.js \
	gallery/classes/ReadingDirection.js \
	gallery/classes/Scaler.js \
	gallery/classes/Scroller.js \
	gallery/classes/ScrollView.js \
	gallery/classes/Page.js \
	gallery/classes/Node.js \
	gallery/classes/ThumbnailBrowser.js \
	gallery/classes/About.js \
	gallery/classes/Index.js \
	$(CONFIG_PATH) \
	gallery/index.js

CLIENT_FILES := \
	robots.txt \
	favicon.ico \
	gallery/index.html \
	gallery/index.css \
	gallery/index.js \
	gallery/folder.png \
	gallery/error.png \
	gallery/background.png \
	gallery/LICENSE

CLIENT_GZIPS := $(addsuffix .gz,$(CLIENT_FILES))

client: $(addprefix $(CLIENT_BUILD_DIR)/,$(CLIENT_FILES)) $(addprefix $(CLIENT_BUILD_DIR)/,$(CLIENT_GZIPS))

clean:
	-rm -rf $(CLIENT_BUILD_DIR)

$(CLIENT_BUILD_DIR)/gallery/index.js: gallery/utilities/externs.js $(CLIENT_SCRIPTS)
	-mkdir -p $(dir $@)
	java -jar $(ROOT_DIR)/deps/compiler-latest/compiler.jar \
		$(addprefix --js=,$(filter-out $<,$^)) \
		--js_output_file=$@ \
		--language_in=ECMASCRIPT5 \
		--compilation_level ADVANCED_OPTIMIZATIONS \
		--externs $< \
		$(CLOSURE_FLAGS) # $$(CLOSURE_FLAGS)

$(CLIENT_BUILD_DIR)/%.css: %.css
	-mkdir -p $(dir $@)
	cat $+ | java -jar $(ROOT_DIR)/deps/yuicompressor-2.4.2/build/yuicompressor-2.4.2.jar --type css --charset utf-8 -o $@

$(CLIENT_BUILD_DIR)/%: %
	-mkdir -p $(dir $@)
	cp -R $< $@

$(CLIENT_BUILD_DIR)/%.gz: $(CLIENT_BUILD_DIR)/%
	-mkdir -p $(dir $@)
	gzip -nc9 $< > $@

Debug_: client
Release_: client
Release_clean: clean
Debug_clean: clean

.PHONY: client clean Debug_ Release_ Release_clean Debug_clean
