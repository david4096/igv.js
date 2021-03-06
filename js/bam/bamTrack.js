/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2014 Broad Institute
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */


var igv = (function (igv) {

        igv.BAMTrack = function (config) {

            this.featureSource = new igv.BamSource(config);

            igv.configTrack(this, config);

            this.coverageTrack = new CoverageTrack(config, this.featureSource);

            this.alignmentTrack = new AlignmentTrack(config, this.featureSource);

            this.visibilityWindow = config.visibilityWindow || 30000;     // 30kb default

            this.alignmentRowHeight = config.alignmentRowHeight || 14;

            this.coverageTrackHeight = config.coverageTrackHeight || 50;

            this.defaultColor = config.defaultColor || "rgb(185, 185, 185)";
            this.color = config.color || this.defaultColor;
            this.negStrandColor = config.negStrandColor || "rgba(150, 150, 230, 0.75)";
            this.posStrandColor = config.posStrandColor || "rgba(230, 150, 150, 0.75)";
            this.firstInfPairColor = "rgba(150, 150, 230, 0.75)";
            this.secondInPairColor = "rgba(230, 150, 150, 0.75)";
            this.insertionColor = config.insertionColor || "rgb(138, 94, 161)";

            this.deletionColor = config.deletionColor || "black";

            this.skippedColor = config.skippedColor || "rgb(150, 170, 170)";

            this.alignmentRowYInset = 0;
            this.alignmentStartGap = 5;
            this.downsampleRowHeight = 10;


            this.alignmentShading = config.alignmentShading || "none";

            // sort alignment rows
            this.sortOption = config.sortOption || {sort: "NUCLEOTIDE"};

            // filter alignments
            this.filterOption = config.filterOption || {name: "mappingQuality", params: [30, undefined]};

            this.sortDirection = true;

            this.viewAsPairs = config.viewAsPairs === undefined ? false : config.viewAsPairs;
        };

        igv.BAMTrack.prototype.getFeatures = function (chr, bpStart, bpEnd) {
            return this.featureSource.getAlignments(chr, bpStart, bpEnd);
        }

        igv.BAMTrack.alignmentShadingOptions = {

            none: function (bamTrack, alignment) {
                return bamTrack.color;
            },

            strand: function (bamTrack, alignment) {
                return alignment.strand ? bamTrack.posStrandColor : bamTrack.negStrandColor;
            },

            firstOfPairStrand: function (bamTrack, alignment) {

                if (alignment.isPaired()) {

                    if (alignment.isFirstOfPair()) {
                        return alignment.strand ? bamTrack.posStrandColor : bamTrack.negStrandColor;
                    }
                    else if (alignment.isSecondOfPair()) {
                        return alignment.strand ? bamTrack.negStrandColor : bamTrack.posStrandColor;
                    }
                    else {
                        console.log("ERROR. Paired alignments are either first or second.")
                    }

                } else {
                    return bamTrack.color;
                }

            }

        };

        igv.BAMTrack.filters = {

            noop: function () {
                return function (alignment) {
                    return false;
                };
            },

            strand: function (strand) {
                return function (alignment) {
                    return alignment.strand === strand;
                };
            },

            mappingQuality: function (lower, upper) {
                return function (alignment) {

                    if (lower && alignment.mq < lower) {
                        return true;
                    }

                    if (upper && alignment.mq > upper) {
                        return true;
                    }

                    return false;
                }
            }
        };

        igv.BAMTrack.selectFilter = function (bamTrack, filterOption) {

            var a,
                b;

            if ("mappingQuality" === filterOption.name) {
                a = bamTrack.filterOption["params"][0];
                b = bamTrack.filterOption["params"][1];
                return igv.BAMTrack.filters[filterOption.name](a, b);
            }

            if ("strand" === filterOption.name) {
                a = bamTrack.filterOption["params"][0];
                return igv.BAMTrack.filters[filterOption.name](a);
            }

            if ("noop" === filterOption.name) {
                return igv.BAMTrack.filters[filterOption.name]();
            }

            return undefined;
        };

        igv.BAMTrack.prototype.filterAlignments = function (filterOption) {

            return new Promise(function (fulfill, reject) {

                var pixelWidth,
                    bpWidth,
                    bpStart,
                    bpEnd,
                    filter;

                filter = igv.BAMTrack.selectFilter(this, filterOption);

                pixelWidth = 3 * this.trackView.canvas.width;
                bpWidth = Math.round(igv.browser.referenceFrame.toBP(pixelWidth));
                bpStart = Math.max(0, Math.round(igv.browser.referenceFrame.start - bpWidth / 3));
                bpEnd = bpStart + bpWidth;

                this.featureSource.getFeatures(igv.browser.referenceFrame.chr, bpStart, bpEnd).then(function (genomicInterval) {

                    genomicInterval.packedAlignmentRows.forEach(function (alignmentRow) {
                        alignmentRow.alignments.forEach(function (alignment) {
                            alignment.hidden = filter(alignment);
                        });
                    });

                });
            });
        }

        // Shift - Click to Filter alignments
        igv.BAMTrack.prototype.shiftClick = function (genomicLocation, event) {

            var self = this;

            this.filterAlignments(this.filterOption).then(function () {
                myself.trackView.update();
                $(myself.trackView.viewportDiv).scrollTop(0);
            });

        };

        // Alt - Click to Sort alignment rows
        igv.BAMTrack.prototype.altClick = function (genomicLocation, event) {

            this.alignmentTrack.sortAlignmentRows(genomicLocation, this.sortOption);

            this.trackView.redrawTile(this.featureSource.alignmentContainer);
            $(this.trackView.viewportDiv).scrollTop(0);

            this.sortDirection = !this.sortDirection;
        };


        /**
         * Optional method to compute pixel height to accomodate the list of features.  The implementation below
         * has side effects (modifiying the samples hash).  This is unfortunate, but harmless.
         *
         * @param features
         * @returns {number}
         */
        igv.BAMTrack.prototype.computePixelHeight = function (alignmentContainer) {

            return this.coverageTrack.computePixelHeight(alignmentContainer) +
                this.alignmentTrack.computePixelHeight(alignmentContainer);

        };

        igv.BAMTrack.prototype.draw = function (options) {

            var self = this,
                alignmentContainer = options.features,
                ctx = options.context,
                bpPerPixel = options.bpPerPixel,
                bpStart = options.bpStart,
                pixelWidth = options.pixelWidth,
                bpEnd = bpStart + pixelWidth * bpPerPixel + 1,
                packedAlignmentRows = alignmentContainer.packedAlignmentRows,
                sequence = alignmentContainer.sequence;

            this.coverageTrack.draw(options);

            this.alignmentTrack.draw(options);
        };

        igv.BAMTrack.prototype.popupData = function (genomicLocation, xOffset, yOffset) {

            if (yOffset >= this.coverageTrack.top && yOffset < this.coverageTrack.height) {
                return this.coverageTrack.popupData(genomicLocation, xOffset, this.coverageTrack.top);
            }
            else {
                return this.alignmentTrack.popupData(genomicLocation, xOffset, yOffset - this.alignmentTrack.top);
            }

        }

        igv.BAMTrack.prototype.popupMenuItems = function (popover) {

            var myself = this,
                menuItems = [],
                lut = {"none": "Color: None", "strand": "Color: Read Strand"},
                checkMark = '<i class="fa fa-check fa-check-shim"></i>',
                checkMarkNone = '<i class="fa fa-check fa-check-shim fa-check-hidden"></i>',
                trackMenuItem = '<div class=\"igv-track-menu-item\">',
                trackMenuItemFirst = '<div class=\"igv-track-menu-item igv-track-menu-border-top\">';

            menuItems.push(igv.colorPickerMenuItem(popover, this.trackView));

            ["none", "strand"].forEach(function (alignmentShading, index) {

                var chosen,
                    str;

                chosen = (0 === index) ? trackMenuItemFirst : trackMenuItem;
                str = (alignmentShading === myself.alignmentShading) ? chosen + checkMark + lut[alignmentShading] + '</div>' : chosen + checkMarkNone + lut[alignmentShading] + '</div>';

                menuItems.push({
                    object: $(str),
                    click: function () {
                        popover.hide();

                        myself.alignmentShading = alignmentShading;
                        myself.trackView.update();
                    }
                });

            });

            return menuItems;

        };


        function shadedBaseColor(qual, nucleotide, genomicLocation) {

            var color,
                alpha,
                minQ = 5,   //prefs.getAsInt(PreferenceManager.SAM_BASE_QUALITY_MIN),
                maxQ = 20,  //prefs.getAsInt(PreferenceManager.SAM_BASE_QUALITY_MAX);
                foregroundColor = igv.nucleotideColorComponents[nucleotide],
                backgroundColor = [255, 255, 255];   // White


            //if (171167156 === genomicLocation) {
            //    // NOTE: Add 1 when presenting genomic location
            //    console.log("shadedBaseColor - locus " + igv.numberFormatter(1 + genomicLocation) + " qual " + qual);
            //}

            if (!foregroundColor) return;

            if (qual < minQ) {
                alpha = 0.1;
            } else {
                alpha = Math.max(0.1, Math.min(1.0, 0.1 + 0.9 * (qual - minQ) / (maxQ - minQ)));
            }
            // Round alpha to nearest 0.1
            alpha = Math.round(alpha * 10) / 10.0;

            if (alpha >= 1) {
                color = igv.nucleotideColors[nucleotide];
            }
            else {
                color = "rgba(" + foregroundColor[0] + "," + foregroundColor[1] + "," + foregroundColor[2] + "," + alpha + ")";    //igv.getCompositeColor(backgroundColor, foregroundColor, alpha);
            }
            return color;
        }


        CoverageTrack = function (config, featureSource) {
            this.featureSource = featureSource;
            this.top = config.coverageTrackTop || 0;
            this.height = config.coverageTrackHeight || 50;
            this.color = config.color || config.defaultColor || "rgb(185, 185, 185)";
        }

        CoverageTrack.prototype.computePixelHeight = function (alignmentContainer) {
            return this.height;
        }

        CoverageTrack.prototype.draw = function (options) {

            var self = this,
                alignmentContainer = options.features,
                ctx = options.context,
                bpPerPixel = options.bpPerPixel,
                bpStart = options.bpStart,
                pixelWidth = options.pixelWidth,
                bpEnd = bpStart + pixelWidth * bpPerPixel + 1,
                coverageMap = alignmentContainer.coverageMap,
                bp,
                x,
                y,
                w,
                h,
                refBase,
                i,
                len,
                item,
                accumulatedHeight,
                sequence;

            if (this.top) ctx.translate(0, top);

            if (coverageMap.refSeq) sequence = coverageMap.refSeq.toUpperCase();


            // paint backdrop color for all coverage buckets
            w = Math.max(1, Math.ceil(1.0 / bpPerPixel));
            for (i = 0, len = coverageMap.coverage.length; i < len; i++) {

                bp = (coverageMap.bpStart + i);
                if (bp < bpStart) continue;
                if (bp > bpEnd) break;

                item = coverageMap.coverage[i];
                if (!item) continue;

                h = Math.round((item.total / coverageMap.maximum) * this.height);
                y = this.height - h;
                x = Math.floor((bp - bpStart) / bpPerPixel);

                igv.graphics.setProperties(ctx, {fillStyle: this.color, strokeStyle: this.color});
                igv.graphics.fillRect(ctx, x, y, w, h);
            }

            // coverage mismatch coloring -- don't try to do this in above loop, color bar will be overwritten when w<1
            if (sequence) {
                for (i = 0, len = coverageMap.coverage.length; i < len; i++) {

                    bp = (coverageMap.bpStart + i);
                    if (bp < bpStart) continue;
                    if (bp > bpEnd) break;

                    item = coverageMap.coverage[i];
                    if (!item) continue;

                    h = (item.total / coverageMap.maximum) * this.height;
                    y = this.height - h;
                    x = Math.floor((bp - bpStart) / bpPerPixel);

                    refBase = sequence[i];
                    if (item.isMismatch(refBase)) {

                        igv.graphics.setProperties(ctx, {fillStyle: igv.nucleotideColors[refBase]});
                        igv.graphics.fillRect(ctx, x, y, w, h);

                        accumulatedHeight = 0.0;
                        ["A", "C", "T", "G"].forEach(function (nucleotide) {

                            var count,
                                hh;

                            count = item["pos" + nucleotide] + item["neg" + nucleotide];


                            // non-logoritmic
                            hh = (count / coverageMap.maximum) * self.height;

                            y = (self.height - hh) - accumulatedHeight;
                            accumulatedHeight += hh;

                            igv.graphics.setProperties(ctx, {fillStyle: igv.nucleotideColors[nucleotide]});
                            igv.graphics.fillRect(ctx, x, y, w, hh);
                        });
                    }
                }
            }

        }

        CoverageTrack.prototype.popupData = function (genomicLocation, xOffset, yOffset) {

            var coverageMap = this.featureSource.alignmentContainer.coverageMap,
                coverageMapIndex,
                coverage,
                nameValues = [];


            coverageMapIndex = genomicLocation - coverageMap.bpStart;
            coverage = coverageMap.coverage[coverageMapIndex];

            if (coverage) {


                nameValues.push(igv.browser.referenceFrame.chr + ":" + igv.numberFormatter(1 + genomicLocation));

                nameValues.push({name: 'Total Count', value: coverage.total});

                // A
                tmp = coverage.posA + coverage.negA;
                if (tmp > 0)  tmp = tmp.toString() + " (" + Math.floor(((coverage.posA + coverage.negA) / coverage.total) * 100.0) + "%)";
                nameValues.push({name: 'A', value: tmp});


                // C
                tmp = coverage.posC + coverage.negC;
                if (tmp > 0)  tmp = tmp.toString() + " (" + Math.floor((tmp / coverage.total) * 100.0) + "%)";
                nameValues.push({name: 'C', value: tmp});

                // G
                tmp = coverage.posG + coverage.negG;
                if (tmp > 0)  tmp = tmp.toString() + " (" + Math.floor((tmp / coverage.total) * 100.0) + "%)";
                nameValues.push({name: 'G', value: tmp});

                // T
                tmp = coverage.posT + coverage.negT;
                if (tmp > 0)  tmp = tmp.toString() + " (" + Math.floor((tmp / coverage.total) * 100.0) + "%)";
                nameValues.push({name: 'T', value: tmp});

                // N
                tmp = coverage.posN + coverage.negN;
                if (tmp > 0)  tmp = tmp.toString() + " (" + Math.floor((tmp / coverage.total) * 100.0) + "%)";
                nameValues.push({name: 'N', value: tmp});

            }


            return nameValues;

        };


        AlignmentTrack = function (config, featureSource) {

            this.featureSource = featureSource;
            this.top = config.coverageTrackHeight + 5 || 55;
            this.alignmentRowHeight = config.alignmentRowHeight || 14;
            this.defaultColor = config.defaultColor || "rgb(185, 185, 185)";
            this.color = config.color || this.defaultColor;
            this.negStrandColor = config.negStrandColor || "rgba(150, 150, 230, 0.75)";
            this.posStrandColor = config.posStrandColor || "rgba(230, 150, 150, 0.75)";
            this.firstInfPairColor = "rgba(150, 150, 230, 0.75)";
            this.secondInPairColor = "rgba(230, 150, 150, 0.75)";
            this.insertionColor = config.insertionColor || "rgb(138, 94, 161)";

            this.deletionColor = config.deletionColor || "black";

            this.skippedColor = config.skippedColor || "rgb(150, 170, 170)";

            this.alignmentRowYInset = 0;
            this.alignmentStartGap = 5;
            this.downsampleRowHeight = config.downsampleRowHeight === undefined ? 5 : config.downsampleRowHeight;


            this.alignmentShading = config.alignmentShading || "none";

            // sort alignment rows
            this.sortOption = config.sortOption || {sort: "NUCLEOTIDE"};

            // filter alignments
            this.filterOption = config.filterOption || {name: "mappingQuality", params: [30, undefined]};

            this.sortDirection = true;
        }

        AlignmentTrack.prototype.computePixelHeight = function (alignmentContainer) {

            if (alignmentContainer.packedAlignmentRows) {
                var h = 0;
                if (alignmentContainer.hasDownsampledIntervals()) {
                    h += this.downsampleRowHeight + this.alignmentStartGap;
                }
                return h + (this.alignmentRowHeight * alignmentContainer.packedAlignmentRows.length) + 5;
            }
            else {
                return this.height;
            }

        }

        AlignmentTrack.prototype.draw = function (options) {
            var self = this,
                alignmentContainer = options.features,
                ctx = options.context,
                bpPerPixel = options.bpPerPixel,
                bpStart = options.bpStart,
                pixelWidth = options.pixelWidth,
                bpEnd = bpStart + pixelWidth * bpPerPixel + 1,
                packedAlignmentRows = alignmentContainer.packedAlignmentRows,
                sequence = alignmentContainer.sequence;

            if (this.top) ctx.translate(0, this.top);

            if (sequence) {
                sequence = sequence.toUpperCase();
            }

            if (alignmentContainer.hasDownsampledIntervals()) {
                self.alignmentRowYInset = self.downsampleRowHeight + this.alignmentStartGap;

                alignmentContainer.downsampledIntervals.forEach(function (interval) {
                    var xBlockStart = (interval.start - bpStart) / bpPerPixel,
                        xBlockEnd = (interval.end - bpStart) / bpPerPixel;

                    if (xBlockEnd - xBlockStart > 5) {
                        xBlockStart += 1;
                        xBlockEnd -= 1;
                    }
                    igv.graphics.fillRect(ctx, xBlockStart, 2, (xBlockEnd - xBlockStart), self.downsampleRowHeight - 2, {fillStyle: "black"});
                })

            }
            else {
                self.alignmentRowYInset = 0;
            }

            packedAlignmentRows.forEach(function renderAlignmentRow(alignmentRow, i) {

                var yRect = self.alignmentRowYInset + (self.alignmentRowHeight * i),
                    alignmentHeight = self.alignmentRowHeight - 2,
                    i,
                    b,
                    alignment;

                for (i = 0; i < alignmentRow.alignments.length; i++) {

                    alignment = alignmentRow.alignments[i];

                    if ((alignment.start + alignment.lengthOnRef) < bpStart) continue;
                    if (alignment.start > bpEnd) break;


                    if (true === alignment.hidden) {
                        continue;
                    }

                    if (alignment instanceof igv.PairedAlignment) {

                        drawPairConnector(alignment);

                        drawSingleAlignment(alignment.firstAlignment);

                        if (alignment.secondAlignment) {
                            drawSingleAlignment(alignment.secondAlignment);

                        }

                    }
                    else {
                        drawSingleAlignment(alignment);
                    }


                    // alignment is a PairedAlignment
                    function drawPairConnector(alignment) {

                        var canvasColor = igv.BAMTrack.alignmentShadingOptions[self.alignmentShading](self, alignment),
                            outlineColor = canvasColor,
                            xBlockStart = (alignment.connectingStart - bpStart) / bpPerPixel,
                            xBlockEnd = (alignment.connectingEnd - bpStart) / bpPerPixel,
                            yStrokedLine = yRect + alignmentHeight / 2;

                        if ((alignment.connectingEnd) < bpStart || alignment.connectingStart > bpEnd) return;

                        if (alignment.mq <= 0) {
                            canvasColor = igv.addAlphaToRGB(canvasColor, "0.15");
                        }

                        igv.graphics.setProperties(ctx, {fillStyle: canvasColor, strokeStyle: outlineColor});

                        igv.graphics.strokeLine(ctx, xBlockStart, yStrokedLine, xBlockEnd, yStrokedLine);

                    }


                    function drawSingleAlignment(alignment) {

                        var canvasColor = igv.BAMTrack.alignmentShadingOptions[self.alignmentShading](self, alignment),
                            outlineColor = canvasColor,
                            lastBlockEnd,
                             blocks = alignment.blocks,
                            block;

                        if ((alignment.start + alignment.lengthOnRef) < bpStart || alignment.start > bpEnd) return;

                        if (alignment.mq <= 0) {
                            canvasColor = igv.addAlphaToRGB(canvasColor, "0.15");
                        }

                        igv.graphics.setProperties(ctx, {fillStyle: canvasColor, strokeStyle: outlineColor});

                        for (b = 0; b < blocks.length; b++) {   // Can't use forEach here -- we need ability to break

                            block = blocks[b];

                            if ((block.start + block.len) < bpStart) continue;

                            drawBlock(block);

                            if ((block.start + block.len) > bpEnd) break;  // Do this after drawBlock to insure gaps are drawn


                            if (alignment.insertions) {
                                alignment.insertions.forEach(function (block) {
                                    var refOffset = block.start - bpStart,
                                        xBlockStart = refOffset / bpPerPixel - 1,
                                        widthBlock = 3;
                                    igv.graphics.fillRect(ctx, xBlockStart, yRect - 1, widthBlock, alignmentHeight + 2, {fillStyle: self.insertionColor});
                                });
                            }

                            function drawBlock(block) {
                                var seqOffset = block.start - alignmentContainer.start,
                                    xBlockStart = (block.start - bpStart) / bpPerPixel,
                                    xBlockEnd = ((block.start + block.len) - bpStart) / bpPerPixel,
                                    widthBlock = Math.max(1, xBlockEnd - xBlockStart),
                                    widthArrowHead = self.alignmentRowHeight / 2.0,
                                    blockSeq = block.seq.toUpperCase(),
                                    skippedColor = self.skippedColor,
                                    deletionColor = self.deletionColor,
                                    refChar,
                                    readChar,
                                    readQual,
                                    xBase,
                                    widthBase,
                                    colorBase,
                                    x,
                                    y,
                                    i,
                                    yStrokedLine = yRect + alignmentHeight / 2;

                                if (block.gapType !== undefined && xBlockEnd !== undefined && lastBlockEnd !== undefined) {
                                    if ("D" === block.gapType) {
                                        igv.graphics.strokeLine(ctx, lastBlockEnd, yStrokedLine, xBlockStart, yStrokedLine, {strokeStyle: deletionColor});
                                    }
                                    else {
                                        igv.graphics.strokeLine(ctx, lastBlockEnd, yStrokedLine, xBlockStart, yStrokedLine, {strokeStyle: skippedColor});
                                    }
                                }
                                lastBlockEnd = xBlockEnd;

                                if (true === alignment.strand && b === blocks.length - 1) {
                                    // Last block on + strand
                                    x = [
                                        xBlockStart,
                                        xBlockEnd,
                                        xBlockEnd + widthArrowHead,
                                        xBlockEnd,
                                        xBlockStart,
                                        xBlockStart];
                                    y = [
                                        yRect,
                                        yRect,
                                        yRect + (alignmentHeight / 2.0),
                                        yRect + alignmentHeight,
                                        yRect + alignmentHeight,
                                        yRect];
                                    igv.graphics.fillPolygon(ctx, x, y, {fillStyle: canvasColor});
                                    if (alignment.mq <= 0) {
                                        igv.graphics.strokePolygon(ctx, x, y, {strokeStyle: outlineColor});
                                    }
                                }
                                else if (false === alignment.strand && b === 0) {
                                    // First block on - strand
                                    x = [
                                        xBlockEnd,
                                        xBlockStart,
                                        xBlockStart - widthArrowHead,
                                        xBlockStart,
                                        xBlockEnd,
                                        xBlockEnd];
                                    y = [
                                        yRect,
                                        yRect,
                                        yRect + (alignmentHeight / 2.0),
                                        yRect + alignmentHeight,
                                        yRect + alignmentHeight,
                                        yRect];
                                    igv.graphics.fillPolygon(ctx, x, y, {fillStyle: canvasColor});
                                    if (alignment.mq <= 0) {
                                        igv.graphics.strokePolygon(ctx, x, y, {strokeStyle: outlineColor});
                                    }
                                }
                                else {
                                    //      igv.graphics.fillRect(ctx, xBlockStart, yRect, widthBlock, height, {fillStyle: "white"});
                                    igv.graphics.fillRect(ctx, xBlockStart, yRect, widthBlock, alignmentHeight, {fillStyle: canvasColor});
                                    if (alignment.mq <= 0) {
                                        ctx.save();
                                        ctx.strokeStyle = outlineColor;
                                        ctx.strokeRect(xBlockStart, yRect, widthBlock, alignmentHeight);
                                        ctx.restore();
                                    }
                                }
                                // Only do mismatch coloring if a refseq exists to do the comparison
                                if (sequence && blockSeq !== "*") {
                                    for (i = 0, len = blockSeq.length; i < len; i++) {
                                        readChar = blockSeq.charAt(i);
                                        refChar = sequence.charAt(seqOffset + i);
                                        if (readChar === "=") {
                                            readChar = refChar;
                                        }
                                        if (readChar === "X" || refChar !== readChar) {
                                            if (block.qual && block.qual.length > i) {
                                                readQual = block.qual[i];
                                                colorBase = shadedBaseColor(readQual, readChar, i + block.start);
                                            }
                                            else {
                                                colorBase = igv.nucleotideColors[readChar];
                                            }
                                            if (colorBase) {
                                                xBase = ((block.start + i) - bpStart) / bpPerPixel;
                                                widthBase = Math.max(1, 1 / bpPerPixel);
                                                igv.graphics.fillRect(ctx, xBase, yRect, widthBase, alignmentHeight, {fillStyle: colorBase});
                                            }
                                        }
                                    }
                                }
                            }
                        }
                   }
                }
            });

        }

        AlignmentTrack.prototype.sortAlignmentRows = function (genomicLocation, sortOption) {

            var self = this,
                alignmentContainer = this.featureSource.alignmentContainer,
                alignmentRows = alignmentContainer.packedAlignmentRows;

            alignmentRows.forEach(function (alignmentRow) {
                alignmentRow.updateScore(genomicLocation, alignmentContainer, sortOption);
            });

            alignmentRows.sort(function (a, b) {
                return self.sortDirection ? a.score - b.score : b.score - a.score;
            });

        }

        function doSortAlignmentRows(genomicLocation, genomicInterval, sortOption, sortDirection) {

            var alignmentRows = genomicInterval.packedAlignmentRows,
                sequence = genomicInterval.sequence;

            if (sequence) {
                sequence = sequence.toUpperCase();
            } else {
                console.log("No sequence, no traversal. No discussion!");
                return;
            }

            alignmentRows.forEach(function (alignmentRow) {
                alignmentRow.updateScore(genomicLocation, genomicInterval, sortOption);
            });

            alignmentRows.sort(function (a, b) {
                return sortDirection ? a.score - b.score : b.score - a.score;
            });

        }

        AlignmentTrack.prototype.popupData = function (genomicLocation, xOffset, yOffset) {

            var packedAlignmentRows = this.featureSource.alignmentContainer.packedAlignmentRows,
                downsampledIntervals = this.featureSource.alignmentContainer.downsampledIntervals,
                packedAlignmentsIndex,
                alignmentRow,
                clickedObject,
                i, len, tmp;

            packedAlignmentsIndex = Math.floor((yOffset - (this.alignmentRowYInset)) / this.alignmentRowHeight);

            if (packedAlignmentsIndex < 0) {

                for (i = 0, len = downsampledIntervals.length; i < len; i++) {


                    if (downsampledIntervals[i].start <= genomicLocation && (downsampledIntervals[i].end >= genomicLocation)) {
                        clickedObject = downsampledIntervals[i];
                        break;
                    }

                }
            }
            else if (packedAlignmentsIndex < packedAlignmentRows.length) {

                alignmentRow = packedAlignmentRows[packedAlignmentsIndex];

                clickedObject = undefined;

                for (i = 0, len = alignmentRow.alignments.length, tmp; i < len; i++) {

                    tmp = alignmentRow.alignments[i];

                    if (tmp.start <= genomicLocation && (tmp.start + tmp.lengthOnRef >= genomicLocation)) {
                        clickedObject = tmp;
                        break;
                    }

                }
            }

            if (clickedObject) {
                return clickedObject.popupData(genomicLocation);
            }
            else {
                return [];
            }

        };
        return igv;

    })
(igv || {});
