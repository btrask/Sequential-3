CLOSURE_FLAGS := --compilation_level WHITESPACE_ONLY --formatting PRETTY_PRINT

.DEFAULT_GOAL := all
CONFIG_PATH := uploader/config.js

VPATH = ../client
include ../client/Makefile

UPLOADER_SCRIPTS := \
	../client/gallery/external/json2.js \
	../client/gallery/utilities/DOM.js \
	uploader/classes/Uploader.js \
	uploader/index.js

UPLOADER_FILES := \
	index.html \
	index.js \
	index.css

UPLOADER_GZIPS := $(addsuffix .gz,$(UPLOADER_FILES))

all: client $(addprefix $(BUILD_DIR)/,$(UPLOADER_FILES)) $(addprefix $(BUILD_DIR)/,$(UPLOADER_GZIPS))

$(BUILD_DIR)/index.js: ../client/gallery/utilities/externs.js $(UPLOADER_SCRIPTS)
	-mkdir -p $(dir $@)
	java -jar ../deps/compiler-latest/compiler.jar $(addprefix --js=,$(filter-out $<,$^)) --js_output_file=$@ --language_in=ECMASCRIPT5 $(CLOSURE_FLAGS) --compilation_level ADVANCED_OPTIMIZATIONS --externs $<

$(BUILD_DIR)/%.css: uploader/%.css
	-mkdir -p $(dir $@)
	cat $+ | java -jar ../deps/yuicompressor-2.4.2/build/yuicompressor-2.4.2.jar --type css --charset utf-8 -o $@

$(BUILD_DIR)/%: uploader/%
	-mkdir -p $(dir $@)
	cp -R $< $@

.PHONY: all
