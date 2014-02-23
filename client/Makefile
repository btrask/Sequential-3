ifndef ROOT_DIR
	ROOT_DIR := ..
endif
CLIENT_DIR := $(ROOT_DIR)/client
ifndef CLIENT_BUILD_DIR
	CLIENT_BUILD_DIR := $(CLIENT_DIR)/build
endif
ifndef CONFIG_PATH
	CONFIG_PATH := $(CLIENT_DIR)/gallery/config.js
endif

CLIENT_SCRIPTS := \
	$(CLIENT_DIR)/gallery/external/json2.js \
	$(CLIENT_DIR)/gallery/external/Array.js \
	$(CLIENT_DIR)/gallery/external/setZeroTimeout.js \
	$(CLIENT_DIR)/gallery/utilities/bt.js \
	$(CLIENT_DIR)/gallery/utilities/sort.js \
	$(CLIENT_DIR)/gallery/utilities/DOM.js \
	$(CLIENT_DIR)/gallery/utilities/Geometry.js \
	$(CLIENT_DIR)/gallery/utilities/KBD.js \
	$(CLIENT_DIR)/gallery/utilities/env.js \
	$(CLIENT_DIR)/gallery/classes/Menu.js \
	$(CLIENT_DIR)/gallery/classes/ReadingDirection.js \
	$(CLIENT_DIR)/gallery/classes/Scaler.js \
	$(CLIENT_DIR)/gallery/classes/Scroller.js \
	$(CLIENT_DIR)/gallery/classes/ScrollView.js \
	$(CLIENT_DIR)/gallery/classes/Page.js \
	$(CLIENT_DIR)/gallery/classes/Node.js \
	$(CLIENT_DIR)/gallery/classes/ThumbnailBrowser.js \
	$(CLIENT_DIR)/gallery/classes/About.js \
	$(CLIENT_DIR)/gallery/classes/Index.js \
	$(CONFIG_PATH) \
	$(CLIENT_DIR)/gallery/index.js

CLIENT_EXTERN := $(CLIENT_DIR)/gallery/utilities/externs.js

CLIENT_FILES := \
	$(CLIENT_BUILD_DIR)/robots.txt \
	$(CLIENT_BUILD_DIR)/favicon.ico \
	$(CLIENT_BUILD_DIR)/gallery/index.html \
	$(CLIENT_BUILD_DIR)/gallery/index.css \
	$(CLIENT_BUILD_DIR)/gallery/index.js \
	$(CLIENT_BUILD_DIR)/gallery/folder.png \
	$(CLIENT_BUILD_DIR)/gallery/error.png \
	$(CLIENT_BUILD_DIR)/gallery/background.png \
	$(CLIENT_BUILD_DIR)/gallery/LICENSE

CLIENT_GZIPS := $(addsuffix .gz,$(CLIENT_FILES))

client: $(CLIENT_FILES) $(CLIENT_GZIPS)

clean:
	-rm -rf $(CLIENT_BUILD_DIR)

$(CLIENT_BUILD_DIR)/gallery/index.js: $(CLIENT_EXTERN) $(CLIENT_SCRIPTS)
	@-mkdir -p $(dir $@)
	java -jar $(ROOT_DIR)/deps/compiler-latest/compiler.jar \
		$(addprefix --js=,$(CLIENT_SCRIPTS)) \
		--js_output_file=$@ \
		--language_in=ECMASCRIPT5 \
		--compilation_level ADVANCED_OPTIMIZATIONS \
		--externs $(CLIENT_EXTERN) \
		$(CLOSURE_FLAGS)

$(CLIENT_BUILD_DIR)/%.css: %.css
	@-mkdir -p $(dir $@)
	cat $+ | java -jar $(ROOT_DIR)/deps/yuicompressor-2.4.2/build/yuicompressor-2.4.2.jar --type css --charset utf-8 -o $@

$(CLIENT_BUILD_DIR)/%: %
	@-mkdir -p $(dir $@)
	cp -R $< $@

$(CLIENT_BUILD_DIR)/%.gz: $(CLIENT_BUILD_DIR)/%
	@-mkdir -p $(dir $@)
	gzip --no-name --to-stdout --best $< > $@

Debug_: client
Release_: client
Release_clean: clean
Debug_clean: clean

.PHONY: client clean Debug_ Release_ Release_clean Debug_clean
