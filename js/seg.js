/**
 * Created by turner on 2/17/14.
 */

/*
    Sample	Chromosome	Start.bp	End.bp	Num.Markers	Log2.Ratio
    BRISK_p_STY37_Mapping250K_Sty_A09_147618	1	742429	48252112	4423	-0.037056
    BRISK_p_STY37_Mapping250K_Sty_A09_147618	1	48258759	103282846	4692	-0.020776
    BRISK_p_STY37_Mapping250K_Sty_A09_147618	1	103299593	197357867	5732	-0.029222
    BRISK_p_STY37_Mapping250K_Sty_A09_147618	1	197357972	247135059	4788	-0.012754
    BRISK_p_STY37_Mapping250K_Sty_A09_147618	2	2994	9950762	1023	-0.021291
*/

var igv = (function (igv) {

    /**
     * @param url - url to a .seg file
     * @constructor
     */
    igv.SEGFeatureSource = function (url) {
        this.url = url;
    };

    /**
     * Required function for parsing SEG file.  Inspect the header
     * line of a line array to ensure it conforms to the SEG format
     *
     * @param line - line from line array
     */
    igv.SEGFeatureSource.prototype.isValidSEGFile = function(line) {

        var i,
            success = 1,
            matches = "Sample	Chromosome	Start.bp	End.bp	Num.Markers	Log2.Ratio".match(/\S+/g),
            lineTokens = line.match(/\S+/g);

        if (lineTokens === null) {
            return !success;
        }

        if (6 !== lineTokens.length) {
            return !success;
        }

        for (i=0; i < lineTokens.length; i++) {
            if (lineTokens[ i ] !== matches[ i ]) {
                return !success;
            }
        }

        return success;
    };

    /**
     * Required function for parsing SEG file.  This is the callback
     * method for lines array method lines.forEach(). This method
     * refers to the 'this' pointer of the featureSource.feature
     * property
     *
     * @param line - current line from line array
     * @param index - line array index
     * @param lines - line array
     */
    function parseLine(line, index, lines) {

        var tokens,
            sampleName,
            chr,
            ss,
            ee,
            dev_null,
            value,
            chrDictionary,
            segFeatures;

        if (igv.isBlank(line)) {
            return;
        }

        if (igv.isComment(line)) {
            return;
        }

        tokens = line.match(/\S+/g);

        sampleName = tokens[0];
        chr = tokens[1];

        ss = tokens[2];
        ee = tokens[3];

        dev_null = tokens[4];

        value = tokens[5];
        this.minimum = Math.min(this.minimum, value);
        this.maximum = Math.max(this.maximum, value);

        chrDictionary = this[ sampleName ];
        if (!chrDictionary) {
            chrDictionary = {};
            this[ sampleName ] = chrDictionary;
        }

        segFeatures = chrDictionary[ chr ];
        if (!segFeatures) {
            segFeatures = [];
            chrDictionary[ chr ] = segFeatures;
        }

        segFeatures.push({ start: ss, end: ee, value: value });
    };

    /**
     * Required function fo all data source objects.  Fetches features for the
     * range requested and passes them on to the continuation function.  Usually this is
     * a method that renders the features on the canvas
     *
     * @param chr
     * @param start
     * @param end
     * @param success -- function that takes an array of features as an argument
     */
    igv.SEGFeatureSource.prototype.getFeatures = function (chr, start, end, success) {

        if (this.features) {
            success(chr, this.features);
        } else {

            var thisSEGFeatureSource = this;

            igv.loadData(this.url, function (data) {

                var lines = data.split("\n");

                if (!thisSEGFeatureSource.isValidSEGFile(lines.shift())) {

                    success(null);
                } else {

                    thisSEGFeatureSource.features = { minimum: Number.MAX_VALUE, maximum: -(Number.MAX_VALUE) };

                    lines.forEach(parseLine, thisSEGFeatureSource.features);

                    success(chr, thisSEGFeatureSource.features);

                }
            });
        }

    };

    return igv;
})(igv || {});