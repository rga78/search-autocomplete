angular.module( "lmSolr", [ "lmUtils" ] )

/**
 * Solr queries.
 */
.factory( "SolrService", 
          [ "StringUtils", "$http", "$q", "$location",
    function(StringUtils,   $http,   $q,   $location) {

    var log = function(msg) {
        console.log("SolrService: " + msg);
    }

    /**
     * ******************************************
     * ******       THE SOLR URL        *********
     * ******************************************
     */
    // var SOLR_URL = "http://localhost:8983/solr";     // in another webserver
    // var SOLR_URL = "http://was.pok.ibm.com:9081/solr";     // in another webserver
    var SOLR_URL = "/solr";     // in same webserver

    /**
     * ******************************************
     * ******       THE SOLR CORE       *********
     * ******************************************
     */
    var SOLR_CORE = "wikisearch";

    /**
     * @return the solr core (document collection)
     */
    var getSolrCore = function() {
        return SOLR_CORE;
    }

    /**
     * @return the solr app url 
     */
    var buildSolrUrl = function(operation) {
        return SOLR_URL 
                    + "/" + getSolrCore() 
                    + "/" + operation ;
    };

    /**
     * Send select query to solr.
     *
     * @return chained promise, where the next 'then' receives the solrResponse object.
     */
    var select = function(queryParms) {

        if ( queryParms == null ) {
            return null;
        }

        queryParms.wt = "json";
        queryParms["json.wrf"] = "JSON_CALLBACK";

        var url = buildSolrUrl("select");
        // log("select: invoking jsonp for search '" + queryString + "' (url=" + url + ")");

        return $http.jsonp(url, { params: queryParms } );
    };


    return {
        select: select
    };

}]);

