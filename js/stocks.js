var StockSearchModel = Backbone.Model.extend({
  defaults: function () {
    return {
      symbol: ''
    };
  },
});




var StockModel = Backbone.Model.extend({
  url: 'https://www.alphavantage.co/query',

  initialize: function () {
    this.url = 'https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&interval=5min&apikey=HY0JP87WH3PG17X6&symbol=' + this.get('symbol');

    var self = this;
    setInterval(function () {
      self.fetch();
    }, 1001 * 60 * 5);
  },

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

  parse: function (rawData) {
    var theResult = {
      date: moment(),
      open: 0,
      high: 0,
      low: 0,
      close: 0,
      volume: 0,
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




var stockTickerView = Backbone.View.extend({
  attributes: {
    class: 'tock-ticker flex-row mr-20 mb-20 p-0 white-bg uppercase',
  },

  initialize: function () {
    this.template = _.template($('#stock_template').html());
    this.listenTo(this.model, 'sync', this.render);
  },

  render: function () {
    var data = this.model.exportForTicker();
    var content = this.template(data);

    $(this.el).html(content);
  },
});

var StockSearchView = Backbone.View.extend({
  el: $('#app'),

  events: {
    'click #add-stock': 'getStockPrice',
    'keyup #stock-symbol': 'checkInput'
  },

  initialize: function () {
    this.stockTemplate = _.template($('#stock_template').html());
    this.model = new StockSearchModel();
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

    if (symbol === '' || this.collection.findWhere({
        symbol: symbol
      })) {
      return;
    }

    if (!company) {
      this.onError();
      return
    }

    this.addButton.addClass('request');

    var stockModel = new StockModel({
      symbol: symbol,
      company: company
    });
    stockModel.fetch({
      data: {
        function: 'TIME_SERIES_INTRADAY',
        interval: '5min',
        apikey: 'HY0JP87WH3PG17X6',
        symbol: symbol
      },
      success: function (model, response, options) {
        self.addButton.removeClass('request');
        self.collection.add(model);
      },
      error: function (response) {
        self.addButton.removeClass('request');
        self.onError(response);
      }
    });
  },

  onError: function () {
    this.addButton.removeClass('request');
    this.$('#stock-search-wrapper').addClass('error');
  },
});