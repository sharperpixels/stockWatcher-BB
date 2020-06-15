var StockSearchModel = Backbone.Model.extend({
  url: 'https://www.alphavantage.co/query',

  defaults: function () {
    return {
      function: 'TIME_SERIES_INTRADAY',
      interval: '5min',
      apikey: 'HY0JP87WH3PG17X6',
      symbol: ''
    };
  },
});

var StockModel = Backbone.Model.extend({
  url: 'https://www.alphavantage.co/query',

  defaults: function () {
    return {
      open: '',
      high: '',
      low: '',
      close: '',
      volume: '',
      symbol: '',
      company: '',
    };
  },

  parse: function (rawData, options) {
    var theResult = {
      date: moment(),
      open: 0,
      high: 0,
      low: 0,
      close: 0,
      volume: 0,
      symbol: options.symbol,
      company: options.company,
    }

    var rawArray = _.mapObject(rawData['Time Series (5min)'], function (val, key) {
      return {
        date: moment(key, 'YYYY-MM-DD HH:mm:ss'),
        open: +(parseFloat(val['1. open'])).toFixed(2),
        high: +(parseFloat(val['2. high'])).toFixed(2),
        low: +(parseFloat(val['3. low'])).toFixed(2),
        close: +(parseFloat(val['4. close'])).toFixed(2),
      }
    });

    var sortedArr = _.sortBy(rawArray, function (obj) {
      return obj.date.unix();
    });
    
    var tradingDay = _.last(sortedArr).date.startOf('day').unix();

    var theDaysRecords = _.filter(sortedArr, function (obj) {
      return obj.date.startOf('day').unix() === tradingDay;
    });

    theResult.open = _.first(theDaysRecords).open;
    theResult.close = _.last(theDaysRecords).close;
    theResult.low = _.min(_.pluck(theDaysRecords, 'low'));
    theResult.high = _.max(_.pluck(theDaysRecords, 'high'));
    
    return theResult;
  },

  exportForTicker: function () {
    var data = $.extend(true, {}, this.toJSON());

    data.change = +(data.close - data.open).toFixed(2);
    data.percent = +((data.change / data.open) * 100).toFixed(2);
    data.down = data.change < 0 ? true : false;

    return data;
  }
});

var StockCollection = Backbone.Collection.extend({
  model: StockModel,

  comparator: 'symbol'
});

var StockSearchView = Backbone.View.extend({
  el: $('#app'),

  events: {
    'click #add-stock': 'getStockPrice',
    'keyup #stock-symbol': 'checkInput'
  },

  initialize: function () {
    this.stockTemplate = _.template($('#stock_template').html());
    this.searchModel = new StockSearchModel();
    this.listenTo(this.searchModel, 'request', this.requestMade);
    this.listenTo(this.collection, 'add', this.tickerAdded);
    this.render();
  },

  render: function () {
    this.addButton = this.$('#add-stock');
    this.$('#stock-symbol').focus();
  },

  tickerAdded: function (model) {
    this.addButton.removeClass('request');
    this.$('#stock-symbol').val('');

    var content = this.stockTemplate(model.exportForTicker());

    this.$('#stock-results').append(content);
  },

  checkInput: function (e) {
    e.preventDefault();
    var val = $(e.target).val().trim();

    if (val.length < 1) {
      $(this.addButton).addClass('disabled', true);
    } else {
      $(this.addButton).removeClass('disabled', false);
    }

    self.$('#stock-search-wrapper').removeClass('error');

    if (e.keyCode === 13) {
      this.getStockPrice(e);
    }
  },

  getStockPrice: function (e) {
    e.preventDefault();
    var self = this,
      symbol = this.$('#stock-symbol').val().trim().toUpperCase(),
      company = this.stockTickers[symbol];

    if (this.collection.findWhere({
        symbol: symbol
      })) {
      return;
    }

    if (!company) {
      this.onError();
      return
    }

    this.searchModel.fetch({
      data: {
        function: 'TIME_SERIES_INTRADAY',
        interval: '5min',
        apikey: 'HY0JP87WH3PG17X6',
        symbol: symbol
      },
      success: function (searchModel, response, options) {
        var newModel = new StockModel(searchModel.toJSON(), {
          symbol: symbol,
          company: company,
          parse: true
        });
        self.collection.add(newModel);
        searchModel.set({
          symbol: ''
        });
      },
      error: function (response) {
        self.onError(response);
      }
    });
  },

  onError: function () {
    this.addButton.removeClass('request');
    this.$('#stock-search-wrapper').addClass('error');
  },

  requestMade: function () {
    this.addButton.addClass('request');
  }
});