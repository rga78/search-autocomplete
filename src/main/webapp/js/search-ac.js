angular.module( "SearchAcApp", [ "ngSanitize", "lmSolr", "lmUtils" ] )

/**
 * NOTE: location.hash changes don't work so well when using a URL like
 * "http://localhost:8080/#my.hash", where the server automatically loads 
 * index.html when no page is specified.  For some reason, the browser
 * removes the '#' from the URL, leaving just "http://localhost:8080/my.hash",
 * which isn't right at all.  I've worked around this in the past by
 * not relying on index.html.  For this app I'll just use the query string,
 * which seems more appropriate anyway.
 */
// .config(function($locationProvider) {
//     $locationProvider.html5Mode( { enabled: true, requireBase: true } );
// })

/**
 * Controller for the auto-complete input form.
 */
.controller( "FormController", [ "$scope", "Utils", "_", "SolrService", "$location", "$rootScope", 
                         function($scope,   Utils,   _ ,  SolrService,   $location,   $rootScope ) {

    console.log("FormController.CTOR: " );

    /**
     * The filtered list of help records is updated dynamically as the user types.
     */
    $scope.autoCompleteResults = [];
    $scope.searchResults = [];
    $scope.solrResponse = null;

    /**
     * For access to Math.min from the view.
     */
    $scope.Math = Math;

    /**
     * This flag controls when the autocomplete results should be shown.
     * The autocomplete results are shown while the user is typing.  When
     * the user hits enter (to submit a regular search), the autocomplete
     * results are hidden and the regular search results are shown.
     */
    $scope.showAutoCompleteResults = false;

    /**
     * Indicates a regular solr search request is pending.  The flag is used
     * to control the visibility of the thinking icon.
     */
    $scope.requestPending = false;

    /**
     * Clear the autocomplete results along with the searchString.
     */
    var clearForm = function() {
        $scope.autoCompleteResults = [];
        $scope.searchString = "";
    }

    /**
     * Hide the autocomplete results listing.
     */
    var hideAutoCompleteResults = function() {
        $scope.showAutoCompleteResults = false;
    }

    /**
     * Parse an auto-compelte search response.
     *
     * {
     *  "responseHeader":{
     *    "status":0,
     *    "QTime":3,
     *    "params":{
     *      "fl":"id,url",
     *      "hl.snippets":"20",
     *      "indent":"true",
     *      "q":"headings:pro",
     *      "hl.simple.pre":"<em>",
     *      "hl.simple.post":"</em>",
     *      "hl.fl":"headings",
     *      "wt":"json",
     *      "hl":"true"
     *    }
     *  },
     *  "response":{
     *      "numFound":1,
     *      "start":0,
     *      "docs":[
     *          {
     *            "id":"http://was.pok.ibm.com/xwiki/bin/view/Liberty/",
     *            "url":"http://was.pok.ibm.com/xwiki/bin/view/Liberty/"
     *          } ]
     *  },
     *  "highlighting":{
     *    "http://was.pok.ibm.com/xwiki/bin/view/Liberty/":{
     *      "headings":[
     *          "<em>Project</em> Liberty - Composable Runtime / Lightweight <em>Profile</em>",
     *          "Documents in <em>Process</em> (View as table)"
     *      ]
     *    }
     *  }
     * }
     *
     * ...is transformed to...
     *
     *  [
     *      { 
     *          "id":"http://was.pok.ibm.com/xwiki/bin/view/Liberty/",
     *          "url":"http://was.pok.ibm.com/xwiki/bin/view/Liberty/",
     *          "heading": "<em>Project</em> Liberty - Composable Runtime / Lightweight <em>Profile</em>"
     *      },
     *      { 
     *          "id":"http://was.pok.ibm.com/xwiki/bin/view/Liberty/",
     *          "url":"http://was.pok.ibm.com/xwiki/bin/view/Liberty/",
     *          "heading": "Documents in <em>Process</em> (View as table)"
     *      }
     *  ]
     *   
     */ 
    var parseSolrAutoCompleteResponse = function(solrResponse) {

        // docs contain just url and id fields.
        var solrDocuments = (solrResponse.responseHeader.status == 0) ? solrResponse.response.docs : [];

        // Find the highlight data for each document.  The hl data is in the
        // "highlighting" field of the response, which itself is an object. 
        // The keys of the hl object are the id's of the solrDocuments.
        // The values are a map of 'highlighted search field' -> 'highlight snippets'.
        // In our case the hl search field is "headings".
        // We want to convert each highlight snippet into an autoCompleteResult.
        //
        // combine map + flatten
        solrDocuments = _.map( solrDocuments, function(solrDocument) {
            var highlighting = solrResponse.highlighting[ solrDocument.id ];
            return _.map( highlighting.headings, function(heading) {
                return _.extend( { heading: heading }, solrDocument );
                // return { id: solrDocument.id, url: solrDocument.url, heading: heading };
            });
        });

        solrDocuments = _.flatten(solrDocuments);

        // console.log("FormController.parseSolrAutoCompleteResponse: " + JSON.stringify(solrDocuments,undefined,2));

        return solrDocuments;
    }

    /**
     * @param str the search string associated with response
     */
    var solrAutoCompleteResponse = function(solrResponse, str) {

        // console.log("FormController.solrAutoCompleteResponse: str:" + str + ", current str:" + $scope.searchString + ", solrResponse: " + JSON.stringify(solrResponse,undefined,2));

        if ($scope.searchString == str) {
            $scope.autoCompleteResults = parseSolrAutoCompleteResponse(solrResponse);
        }
    }

    /**
     * Submit a query to solr against the "headings" field for autocomplete results.
     */
    var solrAutoCompleteSearch = function(str) {
        // console.log("FormController.solrAutoCompleteSearch: " + str);

        if ( Utils.isEmpty(str) || str.length < 3) {
            $scope.autoCompleteResults = [];

        } else {

            SolrService.select(  { q: str,
                                   defType: "dismax",
                                   qf: "headings",
                                   fl: "url,id,title",
                                   hl: "true",
                                   mm: "75%",
                                   pf: "headings^100",
                                   ps: 4,
                                   "hl.fl": "headings",
                                   "hl.simple.pre": "<em>",
                                   "hl.simple.post": "</em>",
                                   "hl.snippets": "20",
                                   "rows": "20" } )
                       .success( function(response) { solrAutoCompleteResponse(response, str); } )
                       .error( Utils.onHttpError );
        }
    };

    /**
     * Called whenever the input field changes
     */
    var onChange = function() {
        // console.log("FormController.onChange: " + $scope.searchString );
        $scope.showAutoCompleteResults = true;

        if (Utils.isEmpty($scope.searchString)) {
            clearForm();
        } else {
            solrAutoCompleteSearch($scope.searchString);
        }
    };

    /**
     * Submit a query to solr for regular (non-autocomplete) search results.
     */
    var solrSearch = function(parsedQuery) {
        // console.log("FormController.solrSearch: " + JSON.stringify(parsedQuery) );

        if ( Utils.isEmpty(parsedQuery.q) ) {
            $scope.searchResults = [];

        } else {

            var defaultParams = { fl: "url,id,title",
                                  defType: "dismax",
                                  qf: "title headings strippedContent",
                                  pf: "title headings strippedContent",
                                  ps: "4",
                                  mm: "75%",
                                  stopWords: "true",
                                  lowercaseOperators: "true",
                                  hl: "true",
                                  "hl.fl": "strippedContent,headings",
                                  "hl.simple.pre": "<em>",
                                  "hl.simple.post": "</em>",
                                  "hl.snippets": "4" };

            $scope.requestPending = true;
            SolrService.select( _.extend( defaultParams, parsedQuery )   )
                       .success( solrSearchResponse )
                       .error( Utils.onHttpError )
                       .finally( function() { $scope.requestPending = false; });
        }
    };

    /**
     * @param str the search string associated with response
     */
    var solrSearchResponse = function(solrResponse, str) {

        // console.log("FormController.solrSearchResponse: str:" + str + ", current str:" + $scope.searchString + ", solrResponse: " + JSON.stringify(solrResponse,undefined,2));
        $scope.searchResults = parseSolrSearchResponse(solrResponse);
        $scope.solrResponse = solrResponse;
    }

    /**
     * Parse a solr search response.
     *
     * {
     *   "responseHeader": {
     *     "status": 0,
     *     "QTime": 22,
     *     "params": {
     *       "lowercaseOperators": "true",
     *       "indent": "true",
     *       "qf": "title headings strippedContent",
     *       "hl.simple.pre": "<em>",
     *       "hl.fl": "title,headings,strippedContent",
     *       "wt": "json",
     *       "hl": "true",
     *       "defType": "edismax",
     *       "fl": "title,url,id",
     *       "q": "comp liberty",
     *       "_": "1432844962582",
     *       "hl.simple.post": "</em>",
     *       "stopwords": "true"
     *     }
     *   },
     *   "response": {
     *     "numFound": 1,
     *     "start": 0,
     *     "docs": [
     *       {
     *         "id": "http://was.pok.ibm.com/xwiki/bin/view/Liberty/",
     *         "title":"Liberty.WebHome",
     *         "url": "http://was.pok.ibm.com/xwiki/bin/view/Liberty/"
     *       }
     *     ]
     *   },
     *   "highlighting": {
     *      "http://was.pok.ibm.com/xwiki/bin/view/Liberty/":{
     *          "headings":[
     *              "Project <em>Liberty</em> - <em>Composable</em> Runtime / Lightweight Profile",
     *              "Documents in <em>Liberty</em> (View as table)"
     *           ],
     *          "strippedContent":[
     *              "Liberty.WebHome Project <em>Liberty</em> - Composable Runtime / Lightweight Profile GSA: Shared charts",
     *              "/v8.5/v8.5GA. Files under that directory: <em>Liberty</em> update site (<em>liberty</em> tools only): st-<em>liberty</em>",
     *              " shipped levels of code. How to… Overview ( and ) <em>Liberty</em> is a server runtime that is highly composable",
     *              " profile' and '<em>liberty</em> profile' servers can be configured <em>Liberty</em> provides an optimized development",
     *              " environment simple config, tools integration, support for Mac <em>Liberty</em> can also be used for production, with"
     *           ]
     *       }
     *   }
     * }
     *
     *
     * ...is transformed to...
     *
     *  [
     *      { 
     *          "id":"http://was.pok.ibm.com/xwiki/bin/view/Liberty/",
     *          "url":"http://was.pok.ibm.com/xwiki/bin/view/Liberty/",
     *          "title":"Liberty.WebHome",
     *          "headings":[
     *              "Project <em>Liberty</em> - <em>Composable</em> Runtime / Lightweight Profile",
     *              "Documents in <em>Liberty</em> (View as table)"
     *           ],
     *          "strippedContent":[
     *              "Liberty.WebHome Project <em>Liberty</em> - Composable Runtime / Lightweight Profile GSA: Shared charts",
     *              "/v8.5/v8.5GA. Files under that directory: <em>Liberty</em> update site (<em>liberty</em> tools only): st-<em>liberty</em>",
     *              " shipped levels of code. How to… Overview ( and ) <em>Liberty</em> is a server runtime that is highly composable",
     *              " profile' and '<em>liberty</em> profile' servers can be configured <em>Liberty</em> provides an optimized development",
     *              " environment simple config, tools integration, support for Mac <em>Liberty</em> can also be used for production, with"
     *           ]
     *      }
     *  ]
     *   
     */ 
    var parseSolrSearchResponse = function(solrResponse) {

        // docs contain just url and id fields.
        var solrDocuments = (solrResponse.responseHeader.status == 0) ? solrResponse.response.docs : [];

        // Add the "highlighting" data associated with each solrDocument to 
        // the solrDocument itself.
        //
        solrDocuments = _.map( solrDocuments, function(solrDocument) {
            var highlighting = solrResponse.highlighting[ solrDocument.id ];
            return _.extend( solrDocument, highlighting );
        });

        // console.log("FormController.parseSolrSearchResponse: " + JSON.stringify(solrDocuments,undefined,2));

        return solrDocuments;
    }

    /**
     * Called when the form is submitted (enter key pressed).
     */
    var onSubmit = function() {
        // console.log("FormController.onSubmit: " + $scope.searchString );

        if (Utils.isEmpty($scope.searchString)) {
            clearForm();
        } else {
            // The search is driven from the onLocationChange event.
            $location.search("q=" + $scope.searchString);
        }
    }

    /**
     * When the search form is submitted, the search string is set in
     * the page's query parms, which triggers a $locationChangeSuccess event.
     * The $locationChangeSuccess event calls this method.
     * This method drives the search request.
     *
     * Note that a $locationChangeSuccess event is also triggered when the
     * the page is first loaded, so if it's loaded with a query string
     * (e.g somebody cut+paste it), then it will drive the search request
     * immediately.
     */
    var onLocationChangeSuccess = function(event, newUrl, oldUrl) {
        // console.log("FormController.onLocationChangeSuccess: new: " + newUrl + ", old: " + oldUrl);

        var parsedQuery = $location.search(); 
        // console.log("FormController.onLocationChangeSuccess: parsedQuery: " + JSON.stringify(parsedQuery,undefined,2) );

        if ( ! Utils.isEmpty(parsedQuery.q) ) {
            hideAutoCompleteResults();
            Utils.scrollTop();
            solrSearch(parsedQuery);
        }
    }

    /**
     * Update the start= parm and trigger a location change.
     */
    var prevPage = function() {
        var parsedQuery = $location.search(); 
        parsedQuery.start = Math.max( (parsedQuery.start || 0) - 10, 0);
        $location.search(parsedQuery);
    }

    /**
     * Update the start= parm and trigger a location change.
     */
    var nextPage = function() {
        var parsedQuery = $location.search(); 
        parsedQuery.start = (parsedQuery.start || 0) + 10;
        $location.search(parsedQuery);
    }

    // Listen for location changes.
    $rootScope.$on( "$locationChangeSuccess", onLocationChangeSuccess );

    // Export to scope.
    $scope.onChange = onChange;
    $scope.onSubmit = onSubmit;
    $scope.clearForm = clearForm;
    $scope.clickBlackout = hideAutoCompleteResults;
    $scope.prevPage = prevPage;
    $scope.nextPage = nextPage;

}])



/**
 * underscore.js support.
 */
.factory('_', function() {
    return window._; // assumes underscore has already been loaded on the page
})

;

