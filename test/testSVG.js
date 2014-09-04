function runSVGUnitTests() {
    module("SVG");


}

function runBEDUnitTests() {

    module("BED");

    asyncTest("BED query", 3, function () {

        var url = "../test/data/sample.bed";

        var bedDataSource = new igv.BedFeatureSource(url);

        var chr = "chr1";
        var bpStart = 0;
        var bpEnd = 2400000;
        bedDataSource.getFeatures(chr, bpStart, bpEnd, function (featureList) {

            ok(featureList);

            var len = featureList.length;

            equal(100, len);   // # of features on chr 1 (determined by greping file)

            // Test 1 feature, insure its on chr1
            var c = featureList[0].chr;
            equal(chr, c);

            start();
        });

    });

    asyncTest("BED all features", 2, function () {

        var url = "../test/data/sample.bed";

        var bedDataSource = new igv.BedFeatureSource(url);


        bedDataSource.allFeatures(function (featureList) {

            ok(featureList);

            var len = featureList.length;

            equal(100, len);   // # of features on chr 1 (determined by greping file)


            start();
        });

    });

    asyncTest("BED query gzip", 3, function () {

        var url = "../test/data/sample.bed.gz";

        var bedDataSource = new igv.BedFeatureSource(url);

        var chr = "chr1";
        var bpStart = 0;
        var bpEnd = 2400000;
        bedDataSource.getFeatures(chr, bpStart, bpEnd, function (featureList) {

            ok(featureList);

            var len = featureList.length;

            equal(100, len);   // # of features on chr 1 (determined by greping file)

            // Test 1 feature, insure its on chr1
            var c = featureList[0].chr;
            equal(chr, c);

            start();
        });

    });


    asyncTest("broadPeak parsing ", 6, function () {

        var url, bedDataSource, chr, bpStart, bpEnd, len, c, feature;

        url = "../test/data/test.broadPeak";

        bedDataSource = new igv.BedFeatureSource(url);

        chr = "chr22";
        bpStart = 17946898;
        bpEnd = 18123485;
        bedDataSource.getFeatures(chr, bpStart, bpEnd, function (featureList) {

            ok(featureList);

            len = featureList.length;

            equal(len, 5);   // # of features over this region

            // Test 1 feature, insure its on chr22
            feature = featureList[0];
            equal(chr, feature.chr);
            equal(feature.start, 17946898);
            ok(feature.end > bpStart);
            equal(feature.signal, 16.723002);

            start();
        });

    });

}