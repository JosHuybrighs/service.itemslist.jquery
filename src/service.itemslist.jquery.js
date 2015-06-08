/****************************************************************************************************** 
 * A jquery plugin implementing a listviewer with the option to do pagination. Both full and partial
 * (paginated) list entries are obtained server-side using AJAX. The server is assumed to return html
 * which the component inserts in the DOM.
 * 
 * Usage:
 *  - Instantiation:
 *      $('#items').itemslist({ itemsCount: count,
 *                              activePageIdx: index,
 *                              maxPagesShown: count,
 *                              itemsPerPage: count,
 *                              onPageRequest: function (el, pageIdx) { ... },
 *                              onNextClick: function (el, newPageIdx) { ... },
 *                              onPrevClick: function (el, newPageIdx) { ... }
 *      });
 *  - External methods:
 *      $('#items').itemslist('getItems', { skipCount: count, maxItems: count });
 *
 * version 1.0.1: Error correction with 'history' handling
 * version 1.0.0: Initial version
 *
 * @requires jQuery 1.8.0 or later
 *
 * Copyright (c) Jos Huybrighs
 * code.cwwonline.be
 *
 * Licensed under the MIT license.
 * http://en.wikipedia.org/wiki/MIT_License
 *
 ******************************************************************************************************/

;(function ($, win, document, undefined) {

    var version = '1.0.1';
    var pluginName = 'itemslist';

    function Plugin(element, options) {
        // Get the main element
        this.element = $(element);
        this._init(options);
    };

    Plugin.prototype = {

        // Get a page of items
        _getPageOfItems: function (skipCount, maxItems, filters, sortCriterium, initPaginator) {
            var backPageUrl = [window.location.protocol, '//', window.location.host, window.location.pathname].join('');
            var reloadGUID = Math.floor(Math.random() * 100000);
            var History = window.History;
            if ( History.enabled ) {
                // Since we want this request to be in the browser history we will push the request to the history
                // and defer the actual loading to the handler attached to the history 'statechange' event.
                var currentIndex = History.getCurrentIndex();
                if (this.settings.useHistory) {
                    // We want each page request in the history: add state
                    History.pushState({
                            skipCount: skipCount, maxItems: maxItems, filters: filters,
                            sortCriterium: sortCriterium, initPaginator: initPaginator,
                            index: currentIndex
                        },
                        null,
                        backPageUrl + '?' + $.param({ skipCount: skipCount, maxItems: maxItems, filters: filters, sortCriterium: sortCriterium, reload: reloadGUID }));
                }
                else {
                    // No history for each page: We must replace the current page entry in the history with the new page
                    // to handle a possible 'back' request to the new page in case the page would have <a href> tags and the
                    // user clicks on them.
                    History.replaceState({
                            skipCount: skipCount, maxItems: maxItems,
                            filters: filters, sortCriterium: sortCriterium, initPaginator: true,
                            index: currentIndex
                        },
                        null,
                        backPageUrl + '?' + $.param({ skipCount: skipCount, maxItems: maxItems, filters: filters, sortCriterium: sortCriterium, reload: reloadGUID }));
                    if (!this.settings.usePaginator) {
                    }
                }
            }
            else {
                // No history support. Just load the new page.
                this._loadPageOfItems(skipCount, maxItems, filters, sortCriterium, initPaginator);
            }
        },

        // Load a page of items using AJAX
        _loadPageOfItems: function (skipCount, maxItems, filters, sortCriterium, initPaginator) {
            this.settings.onBeginLoadItems();
            this.loadSkipCount = skipCount;
            this.loadMaxItems = maxItems;
            this.loadFilters = filters;
            this.loadSortCriterium = sortCriterium;
            var self = this;
            var listParms = { skipCount: skipCount, maxItems: maxItems, filters: filters, sortCriterium: sortCriterium };
            $.ajax({
                url: this.settings.listUrl,
                cache: false,
                dataType: "html", // Type of data returned by the server
                traditional: true,
                data: listParms,
                success: function (data) {
                    // Show items
                    self.element.html(data);
                    if (self.settings.usePaginator) {
                        // Save total number of items (across all pages)
                        self.settings.totalItemsCount = $(self.settings.totalNrOfItemsElement).val();
                        // Reinit paginator (if told to do so)
                        if (initPaginator) {
                            var activePageIdx = skipCount / maxItems;
                            self.settings.onInitPaginator(self.settings.totalItemsCount, activePageIdx);
                        }
                        listParms.totalItemsCount = self.settings.totalItemsCount;
                    }
                    // Inform client that a new set of items has been loaded and presented
                    self.settings.onEndLoadItems(false, listParms, null);
                    if (self.settings.usePaginator) {
                        // Check if there were actually items returned
                        var returnedItemsCount = $(self.settings.displNrOfItemsElement).val();
                        if (returnedItemsCount == 0 &&
                            skipCount != 0) {
                            // No - Load preceeding page (if any)
                            self._getPageOfItems(skipCount - maxItems, maxItems, filters, sortCriterium, true);
                        }
                    }
                },
                error: function (request, status, error) {
                    if (self.settings.usePaginator) {
                        listParms.totalItemsCount = 0;
                    }
                    self.settings.onEndLoadItems(true, listParms, request.responseText);
                }
            });
        },

        // Initialize
        _init: function (options) {
            var self = this;
            var defaults =
            {
                listUrl: '/umbraco/surface/ItemsArchive/GetItems',
                reqFilters: null,
                reqSortCriterium: null,
                useHistory: false,  // When true all page requests are put in the browser history.
                onBeginLoadItems: function () { },
                onEndLoadItems: function (isError, listParms, responseText) { },
                // The next settings are only applicable when using a paginator 
                usePaginator: true,
                maxItems: 100,      // The maximum number of items that are allowed on a single page
                reqSkipCount: 0,    // This number controls which page must become visible. The page is defined
                                    // by dividing this number by maxItems.
                displNrOfItemsElement: '#displNrOfItems',  // The hidden input element that is present in the HTML data that
                                                           // is returned in the AJAX request to get list items.
                                                           // The input element is expected to hold the number of items
                                                           // returned in the list (displayed). 
                totalNrOfItemsElement: '#totalNrOfItems',  // The hidden input element that is present in the HTML data that
                                                           // is returned in the AJAX request to get a page of list items.
                                                           // The input element is expected to hold the (possibly modified) total number
                                                           // of items across all pages. 
                onInitPaginator: function (itemsCount, activePageIdx) { }
            };
            this.settings = $.extend(defaults, options || {});
            this.settings.totalItemsCount = 0;

            // Prepare for History handling
            var History = window.History;
            if (History.enabled) {
                // Bind to StateChange Event
                History.Adapter.bind(window, 'statechange', function () {
                    var state = History.getState();
                    if (state.data.skipCount !== undefined) {
                        self.settings.reqSkipCount = state.data.skipCount;
                        self.settings.reqSortCriterium = state.data.sortCriterium;
                        self.settings.reqFilters = state.data.filters;
                        // Check if we came here because of an internal event (user selects from the years dropdown box or
                        // user selects page through the paginator) or because the 'back' button was pressed/touched.
                        var initPaginator = self.settings.usePaginator;
                        if (state.data.index >= 0) {
                            var currentIndex = History.getCurrentIndex();
                            var internal = (state.data.index == (currentIndex - 1));
                            if (internal) {
                                // Internal request: request to re-initialize paginator is defined in the history state object
                                initPaginator = state.data.initPaginator;
                            }
                            else {
                                // 'Back' request: we must re-initialize the paginator
                                initPaginator = true;
                            }
                            // Load page of items
                            self._loadPageOfItems(self.settings.reqSkipCount, self.settings.maxItems,
                                                  self.settings.reqFilters, self.settings.reqSortCriterium, initPaginator);
                        }
                    }
                    else {

                    }
                });

                // Replace history entry for the current page with one with query string
                var backPageUrl = [window.location.protocol, '//', window.location.host, window.location.pathname].join('');
                var reloadGUID = Math.floor(Math.random() * 100000);
                History.replaceState({
                        skipCount: this.settings.reqSkipCount, maxItems: this.settings.maxItems,
                        filters: this.settings.reqFilters,
                        sortCriterium: this.settings.reqSortCriterium,
                        initPaginator: this.settings.usePaginator,
                        index: 0
                    },
                    null,
                    backPageUrl + '?' + $.param({ skipCount: this.settings.reqSkipCount, maxItems: this.settings.maxItems, filters: this.settings.reqFilters, sortCriterium: this.settings.reqSortCriterium, reload: reloadGUID }));
            }
            else {
            // No history handling - Load all list items
            this._loadPageOfItems((self.settings.usePaginator) ? self.settings.reqSkipCount : 0,
                                  (self.settings.usePaginator) ? self.settings.maxItems : 0,
                                  self.settings.reqFilters, self.settings.reqSortCriterium, this.settings.usePaginator);
            }
        },

        // Set list retrieval parameters
        // Arguments:
        // - argsArray: An array where the first element is an object with 3 fields:
        //              maxItems, reqFilters, and reqSortCriterium
        setListParms: function (argsArray) {
            var args = argsArray[0];
            this.settings.maxItems = args.maxItems;
            this.settings.reqFilters = args.reqFilters;
            this.settings.reqSortCriterium = args.reqSortCriterium;
        },

        // Get items
        // Arguments:
        // - argsArray: An array where the first element is an object with 2 fields:
        //              skipCount and initPaginator
        getItems: function (argsArray) {
            var args = argsArray[0];
            this._getPageOfItems(args.skipCount, this.settings.maxItems, this.settings.reqFilters, this.settings.reqSortCriterium, args.initPaginator);
        },

        // Reload items
        // Arguments: none
        reloadItems: function (argsArray) {
            this._getPageOfItems(this.loadSkipCount, this.loadMaxItems, this.loadFilters, this.loadSortCriterium, true);
        }

    };

    $.fn[pluginName] = function (methodOrOptions) {
        var instance = $(this).data(pluginName);
        if (instance &&
             methodOrOptions.indexOf('_') != 0) {
            return instance[methodOrOptions](Array.prototype.slice.call(arguments, 1));
        }
        if (typeof methodOrOptions === 'object' || !methodOrOptions) {
            instance = new Plugin(this, methodOrOptions);
            $(this).data(pluginName, instance);
            return $(this);
        }
        $.error('Wrong call to ' + pluginName);
    };

})(jQuery);