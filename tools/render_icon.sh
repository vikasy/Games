#!/bin/bash -e
swift -module-cache-path ${TMPDIR:-/tmp}/swift-cache gen_fa_arcade_icon.swift > /dev/null
