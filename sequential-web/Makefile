ifndef ROOT_DIR
	ROOT_DIR := ..
endif
SEQ_WEB_DIR = $(ROOT_DIR)/sequential-web
CLIENT_BUILD_DIR := $(SEQ_WEB_DIR)/build

CLOSURE_FLAGS := \
	--compilation_level WHITESPACE_ONLY \
	--formatting PRETTY_PRINT

.DEFAULT_GOAL := all
CONFIG_PATH := $(SEQ_WEB_DIR)/uploader/config.js

VPATH = $(ROOT_DIR)/client
include $(ROOT_DIR)/client/Makefile

UPLOADER_SCRIPTS := \
	$(CLIENT_DIR)/gallery/external/json2.js \
	$(CLIENT_DIR)/gallery/utilities/DOM.js \
	$(SEQ_WEB_DIR)/uploader/classes/Uploader.js \
	$(SEQ_WEB_DIR)/uploader/index.js

UPLOADER_FILES := \
	$(CLIENT_BUILD_DIR)/index.html \
	$(CLIENT_BUILD_DIR)/index.js \
	$(CLIENT_BUILD_DIR)/index.css

UPLOADER_GZIPS := $(addsuffix .gz,$(UPLOADER_FILES))

all: client $(UPLOADER_FILES) $(UPLOADER_GZIPS)

$(CLIENT_BUILD_DIR)/index.js: $(CLIENT_EXTERN) $(UPLOADER_SCRIPTS)
	@-mkdir -p $(dir $@)
	java -jar $(ROOT_DIR)/deps/compiler-latest/compiler.jar \
		$(addprefix --js=,$(UPLOADER_SCRIPTS)) \
		--js_output_file=$@ \
		--language_in=ECMASCRIPT5 \
		--compilation_level ADVANCED_OPTIMIZATIONS \
		--externs $(CLIENT_EXTERN) \
		$(CLOSURE_FLAGS)

$(CLIENT_BUILD_DIR)/%.css: $(SEQ_WEB_DIR)/uploader/%.css
	@-mkdir -p $(dir $@)
	cat $+ | java -jar $(ROOT_DIR)/deps/yuicompressor-2.4.2/build/yuicompressor-2.4.2.jar --type css --charset utf-8 -o $@

$(CLIENT_BUILD_DIR)/%: $(SEQ_WEB_DIR)/uploader/%
	@-mkdir -p $(dir $@)
	cp -R $< $@

.PHONY: all
