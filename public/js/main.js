(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],2:[function(require,module,exports){
/**
 * Default client.
 */

module.exports = function (_) {

    var xhrClient = require('./xhr')(_);

    return function (request) {
        return (request.client || xhrClient)(request);
    };

};

},{"./xhr":4}],3:[function(require,module,exports){
/**
 * JSONP client.
 */

module.exports = function (_) {

    var Promise = require('../promise')(_);

    return function (request) {
        return new Promise(function (resolve) {

            var callback = '_jsonp' + Math.random().toString(36).substr(2), response = {request: request, data: null}, handler, script;

            request.params[request.jsonp] = callback;
            request.cancel = function () {
                handler({type: 'cancel'});
            };

            script = document.createElement('script');
            script.src = _.url(request);
            script.type = 'text/javascript';
            script.async = true;

            window[callback] = function (data) {
                response.data = data;
            };

            handler = function (event) {

                if (event.type === 'load' && response.data !== null) {
                    response.status = 200;
                } else if (event.type === 'error') {
                    response.status = 404;
                } else {
                    response.status = 0;
                }

                resolve(response);

                delete window[callback];
                document.body.removeChild(script);
            };

            script.onload = handler;
            script.onerror = handler;

            document.body.appendChild(script);
        });
    };

};

},{"../promise":18}],4:[function(require,module,exports){
/**
 * XMLHttp client.
 */

module.exports = function (_) {

    var Promise = require('../promise')(_);

    return function (request) {
        return new Promise(function (resolve) {

            var xhr = new XMLHttpRequest(), response = {request: request}, handler;

            request.cancel = function () {
                xhr.abort();
            };

            xhr.open(request.method, _.url(request), true);

            if (_.isPlainObject(request.xhr)) {
                _.extend(xhr, request.xhr);
            }

            _.each(request.headers || {}, function (value, header) {
                xhr.setRequestHeader(header, value);
            });

            handler = function (event) {

                response.data = xhr.responseText;
                response.status = xhr.status;
                response.statusText = xhr.statusText;
                response.headers = getHeaders(xhr);

                resolve(response);
            };

            xhr.onload = handler;
            xhr.onabort = handler;
            xhr.onerror = handler;

            xhr.send(request.data);
        });
    };

    function getHeaders(xhr) {

        var headers;

        if (!headers) {
            headers = parseHeaders(xhr.getAllResponseHeaders());
        }

        return function (name) {

            if (name) {
                return headers[_.toLower(name)];
            }

            return headers;
        };
    }

    function parseHeaders(str) {

        var headers = {}, value, name, i;

        if (_.isString(str)) {
            _.each(str.split('\n'), function (row) {

                i = row.indexOf(':');
                name = _.trim(_.toLower(row.slice(0, i)));
                value = _.trim(row.slice(i + 1));

                if (headers[name]) {

                    if (_.isArray(headers[name])) {
                        headers[name].push(value);
                    } else {
                        headers[name] = [headers[name], value];
                    }

                } else {

                    headers[name] = value;
                }

            });
        }

        return headers;
    }

};

},{"../promise":18}],5:[function(require,module,exports){
/**
 * Service for sending network requests.
 */

module.exports = function (_) {

    var Promise = require('./promise')(_);
    var interceptor = require('./interceptor')(_);
    var defaultClient = require('./client/default')(_);
    var jsonType = {'Content-Type': 'application/json'};

    function Http(url, options) {

        var client = defaultClient, request, promise;

        if (_.isPlainObject(url)) {
            options = url;
            url = '';
        }

        request = _.extend({url: url}, options);
        request = _.extend(true, {},
            Http.options, this.options, request
        );

        Http.interceptors.forEach(function (i) {
            client = interceptor(i, this.vm)(client);
        }, this);

        promise = client(request).bind(this.vm).then(function (response) {

            response.ok = response.status >= 200 && response.status < 300;
            return response.ok ? response : Promise.reject(response);

        }, function (response) {

            if (response instanceof Error) {
                _.error(response);
            }

            return Promise.reject(response);
        });

        if (request.success) {
            promise.success(request.success);
        }

        if (request.error) {
            promise.error(request.error);
        }

        return promise;
    }

    Http.options = {
        method: 'get',
        data: '',
        params: {},
        headers: {},
        xhr: null,
        jsonp: 'callback',
        beforeSend: null,
        crossOrigin: null,
        emulateHTTP: false,
        emulateJSON: false,
        timeout: 0
    };

    Http.interceptors = [
        require('./interceptor/before')(_),
        require('./interceptor/timeout')(_),
        require('./interceptor/jsonp')(_),
        require('./interceptor/method')(_),
        require('./interceptor/mime')(_),
        require('./interceptor/header')(_),
        require('./interceptor/cors')(_)
    ];

    Http.headers = {
        put: jsonType,
        post: jsonType,
        patch: jsonType,
        delete: jsonType,
        common: {'Accept': 'application/json, text/plain, */*'},
        custom: {'X-Requested-With': 'XMLHttpRequest'}
    };

    ['get', 'put', 'post', 'patch', 'delete', 'jsonp'].forEach(function (method) {

        Http[method] = function (url, data, success, options) {

            if (_.isFunction(data)) {
                options = success;
                success = data;
                data = undefined;
            }

            if (_.isObject(success)) {
                options = success;
                success = undefined;
            }

            return this(url, _.extend({method: method, data: data, success: success}, options));
        };
    });

    return _.http = Http;
};

},{"./client/default":2,"./interceptor":10,"./interceptor/before":7,"./interceptor/cors":8,"./interceptor/header":9,"./interceptor/jsonp":11,"./interceptor/method":12,"./interceptor/mime":13,"./interceptor/timeout":14,"./promise":18}],6:[function(require,module,exports){
/**
 * Install plugin.
 */

function install(Vue) {

    var _ = require('./lib/util')(Vue);

    Vue.url = require('./url')(_);
    Vue.http = require('./http')(_);
    Vue.resource = require('./resource')(_);
    Vue.promise = require('./promise')(_);

    Object.defineProperties(Vue.prototype, {

        $url: {
            get: function () {
                return _.options(Vue.url, this, this.$options.url);
            }
        },

        $http: {
            get: function () {
                return _.options(Vue.http, this, this.$options.http);
            }
        },

        $resource: {
            get: function () {
                return Vue.resource.bind(this);
            }
        }

    });
}

if (window.Vue) {
    Vue.use(install);
}

module.exports = install;

},{"./http":5,"./lib/util":17,"./promise":18,"./resource":19,"./url":20}],7:[function(require,module,exports){
/**
 * Before Interceptor.
 */

module.exports = function (_) {

    return {

        request: function (request) {

            if (_.isFunction(request.beforeSend)) {
                request.beforeSend.call(this, request);
            }

            return request;
        }

    };

};

},{}],8:[function(require,module,exports){
/**
 * CORS Interceptor.
 */

module.exports = function (_) {

    var originUrl = _.url.parse(location.href);
    var xdrClient = require('../client/jsonp')(_);
    var xhrCors = 'withCredentials' in new XMLHttpRequest();

    return {

        request: function (request) {

            if (request.crossOrigin === null) {
                request.crossOrigin = crossOrigin(request);
            }

            if (request.crossOrigin) {

                if (!xhrCors) {
                    request.client = xdrClient;
                }

                request.emulateHTTP = false;
            }

            return request;
        }

    };

    function crossOrigin(request) {

        var requestUrl = _.url.parse(_.url(request));

        return (requestUrl.protocol !== originUrl.protocol || requestUrl.host !== originUrl.host);
    }

};

},{"../client/jsonp":3}],9:[function(require,module,exports){
/**
 * Header Interceptor.
 */

module.exports = function (_) {

    return {

        request: function (request) {

            request.method = request.method.toUpperCase();
            request.headers = _.extend({}, _.http.headers.common,
                !request.crossOrigin ? _.http.headers.custom : {},
                _.http.headers[request.method.toLowerCase()],
                request.headers
            );

            if (_.isPlainObject(request.data) && /^(GET|JSONP)$/i.test(request.method)) {
                _.extend(request.params, request.data);
                delete request.data;
            }

            return request;
        }

    };

};

},{}],10:[function(require,module,exports){
/**
 * Interceptor factory.
 */

module.exports = function (_) {

    var Promise = require('../promise')(_);

    return function (handler, vm) {
        return function (client) {

            if (_.isFunction(handler)) {
                handler = handler.call(vm, Promise);
            }

            return function (request) {

                if (_.isFunction(handler.request)) {
                    request = handler.request.call(vm, request);
                }

                return when(request, function (request) {
                    return when(client(request), function (response) {

                        if (_.isFunction(handler.response)) {
                            response = handler.response.call(vm, response);
                        }

                        return response;
                    });
                });
            };
        };
    };

    function when(value, fulfilled, rejected) {

        var promise = Promise.resolve(value);

        if (arguments.length < 2) {
            return promise;
        }

        return promise.then(fulfilled, rejected);
    }

};

},{"../promise":18}],11:[function(require,module,exports){
/**
 * JSONP Interceptor.
 */

module.exports = function (_) {

    var jsonpClient = require('../client/jsonp')(_);

    return {

        request: function (request) {

            if (request.method == 'JSONP') {
                request.client = jsonpClient;
            }

            return request;
        }

    };

};

},{"../client/jsonp":3}],12:[function(require,module,exports){
/**
 * HTTP method override Interceptor.
 */

module.exports = function (_) {

    return {

        request: function (request) {

            if (request.emulateHTTP && /^(PUT|PATCH|DELETE)$/i.test(request.method)) {
                request.headers['X-HTTP-Method-Override'] = request.method;
                request.method = 'POST';
            }

            return request;
        }

    };

};

},{}],13:[function(require,module,exports){
/**
 * Mime Interceptor.
 */

module.exports = function (_) {

    return {

        request: function (request) {

            if (request.emulateJSON && _.isPlainObject(request.data)) {
                request.headers['Content-Type'] = 'application/x-www-form-urlencoded';
                request.data = _.url.params(request.data);
            }

            if (_.isObject(request.data) && /FormData/i.test(request.data.toString())) {
                delete request.headers['Content-Type'];
            }

            if (_.isPlainObject(request.data)) {
                request.data = JSON.stringify(request.data);
            }

            return request;
        },

        response: function (response) {

            try {
                response.data = JSON.parse(response.data);
            } catch (e) {}

            return response;
        }

    };

};

},{}],14:[function(require,module,exports){
/**
 * Timeout Interceptor.
 */

module.exports = function (_) {

    return function () {

        var timeout;

        return {

            request: function (request) {

                if (request.timeout) {
                    timeout = setTimeout(function () {
                        request.cancel();
                    }, request.timeout);
                }

                return request;
            },

            response: function (response) {

                clearTimeout(timeout);

                return response;
            }

        };
    };

};

},{}],15:[function(require,module,exports){
/**
 * Promises/A+ polyfill v1.1.4 (https://github.com/bramstein/promis)
 */

module.exports = function (_) {

    var RESOLVED = 0;
    var REJECTED = 1;
    var PENDING  = 2;

    function Promise(executor) {

        this.state = PENDING;
        this.value = undefined;
        this.deferred = [];

        var promise = this;

        try {
            executor(function (x) {
                promise.resolve(x);
            }, function (r) {
                promise.reject(r);
            });
        } catch (e) {
            promise.reject(e);
        }
    }

    Promise.reject = function (r) {
        return new Promise(function (resolve, reject) {
            reject(r);
        });
    };

    Promise.resolve = function (x) {
        return new Promise(function (resolve, reject) {
            resolve(x);
        });
    };

    Promise.all = function all(iterable) {
        return new Promise(function (resolve, reject) {
            var count = 0, result = [];

            if (iterable.length === 0) {
                resolve(result);
            }

            function resolver(i) {
                return function (x) {
                    result[i] = x;
                    count += 1;

                    if (count === iterable.length) {
                        resolve(result);
                    }
                };
            }

            for (var i = 0; i < iterable.length; i += 1) {
                Promise.resolve(iterable[i]).then(resolver(i), reject);
            }
        });
    };

    Promise.race = function race(iterable) {
        return new Promise(function (resolve, reject) {
            for (var i = 0; i < iterable.length; i += 1) {
                Promise.resolve(iterable[i]).then(resolve, reject);
            }
        });
    };

    var p = Promise.prototype;

    p.resolve = function resolve(x) {
        var promise = this;

        if (promise.state === PENDING) {
            if (x === promise) {
                throw new TypeError('Promise settled with itself.');
            }

            var called = false;

            try {
                var then = x && x['then'];

                if (x !== null && typeof x === 'object' && typeof then === 'function') {
                    then.call(x, function (x) {
                        if (!called) {
                            promise.resolve(x);
                        }
                        called = true;

                    }, function (r) {
                        if (!called) {
                            promise.reject(r);
                        }
                        called = true;
                    });
                    return;
                }
            } catch (e) {
                if (!called) {
                    promise.reject(e);
                }
                return;
            }

            promise.state = RESOLVED;
            promise.value = x;
            promise.notify();
        }
    };

    p.reject = function reject(reason) {
        var promise = this;

        if (promise.state === PENDING) {
            if (reason === promise) {
                throw new TypeError('Promise settled with itself.');
            }

            promise.state = REJECTED;
            promise.value = reason;
            promise.notify();
        }
    };

    p.notify = function notify() {
        var promise = this;

        _.nextTick(function () {
            if (promise.state !== PENDING) {
                while (promise.deferred.length) {
                    var deferred = promise.deferred.shift(),
                        onResolved = deferred[0],
                        onRejected = deferred[1],
                        resolve = deferred[2],
                        reject = deferred[3];

                    try {
                        if (promise.state === RESOLVED) {
                            if (typeof onResolved === 'function') {
                                resolve(onResolved.call(undefined, promise.value));
                            } else {
                                resolve(promise.value);
                            }
                        } else if (promise.state === REJECTED) {
                            if (typeof onRejected === 'function') {
                                resolve(onRejected.call(undefined, promise.value));
                            } else {
                                reject(promise.value);
                            }
                        }
                    } catch (e) {
                        reject(e);
                    }
                }
            }
        });
    };

    p.then = function then(onResolved, onRejected) {
        var promise = this;

        return new Promise(function (resolve, reject) {
            promise.deferred.push([onResolved, onRejected, resolve, reject]);
            promise.notify();
        });
    };

    p.catch = function (onRejected) {
        return this.then(undefined, onRejected);
    };

    return Promise;
};

},{}],16:[function(require,module,exports){
/**
 * URL Template v2.0.6 (https://github.com/bramstein/url-template)
 */

exports.expand = function (url, params, variables) {

    var tmpl = this.parse(url), expanded = tmpl.expand(params);

    if (variables) {
        variables.push.apply(variables, tmpl.vars);
    }

    return expanded;
};

exports.parse = function (template) {

    var operators = ['+', '#', '.', '/', ';', '?', '&'], variables = [];

    return {
        vars: variables,
        expand: function (context) {
            return template.replace(/\{([^\{\}]+)\}|([^\{\}]+)/g, function (_, expression, literal) {
                if (expression) {

                    var operator = null, values = [];

                    if (operators.indexOf(expression.charAt(0)) !== -1) {
                        operator = expression.charAt(0);
                        expression = expression.substr(1);
                    }

                    expression.split(/,/g).forEach(function (variable) {
                        var tmp = /([^:\*]*)(?::(\d+)|(\*))?/.exec(variable);
                        values.push.apply(values, exports.getValues(context, operator, tmp[1], tmp[2] || tmp[3]));
                        variables.push(tmp[1]);
                    });

                    if (operator && operator !== '+') {

                        var separator = ',';

                        if (operator === '?') {
                            separator = '&';
                        } else if (operator !== '#') {
                            separator = operator;
                        }

                        return (values.length !== 0 ? operator : '') + values.join(separator);
                    } else {
                        return values.join(',');
                    }

                } else {
                    return exports.encodeReserved(literal);
                }
            });
        }
    };
};

exports.getValues = function (context, operator, key, modifier) {

    var value = context[key], result = [];

    if (this.isDefined(value) && value !== '') {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            value = value.toString();

            if (modifier && modifier !== '*') {
                value = value.substring(0, parseInt(modifier, 10));
            }

            result.push(this.encodeValue(operator, value, this.isKeyOperator(operator) ? key : null));
        } else {
            if (modifier === '*') {
                if (Array.isArray(value)) {
                    value.filter(this.isDefined).forEach(function (value) {
                        result.push(this.encodeValue(operator, value, this.isKeyOperator(operator) ? key : null));
                    }, this);
                } else {
                    Object.keys(value).forEach(function (k) {
                        if (this.isDefined(value[k])) {
                            result.push(this.encodeValue(operator, value[k], k));
                        }
                    }, this);
                }
            } else {
                var tmp = [];

                if (Array.isArray(value)) {
                    value.filter(this.isDefined).forEach(function (value) {
                        tmp.push(this.encodeValue(operator, value));
                    }, this);
                } else {
                    Object.keys(value).forEach(function (k) {
                        if (this.isDefined(value[k])) {
                            tmp.push(encodeURIComponent(k));
                            tmp.push(this.encodeValue(operator, value[k].toString()));
                        }
                    }, this);
                }

                if (this.isKeyOperator(operator)) {
                    result.push(encodeURIComponent(key) + '=' + tmp.join(','));
                } else if (tmp.length !== 0) {
                    result.push(tmp.join(','));
                }
            }
        }
    } else {
        if (operator === ';') {
            result.push(encodeURIComponent(key));
        } else if (value === '' && (operator === '&' || operator === '?')) {
            result.push(encodeURIComponent(key) + '=');
        } else if (value === '') {
            result.push('');
        }
    }

    return result;
};

exports.isDefined = function (value) {
    return value !== undefined && value !== null;
};

exports.isKeyOperator = function (operator) {
    return operator === ';' || operator === '&' || operator === '?';
};

exports.encodeValue = function (operator, value, key) {

    value = (operator === '+' || operator === '#') ? this.encodeReserved(value) : encodeURIComponent(value);

    if (key) {
        return encodeURIComponent(key) + '=' + value;
    } else {
        return value;
    }
};

exports.encodeReserved = function (str) {
    return str.split(/(%[0-9A-Fa-f]{2})/g).map(function (part) {
        if (!/%[0-9A-Fa-f]/.test(part)) {
            part = encodeURI(part);
        }
        return part;
    }).join('');
};

},{}],17:[function(require,module,exports){
/**
 * Utility functions.
 */

module.exports = function (Vue) {

    var _ = Vue.util.extend({}, Vue.util), config = Vue.config, console = window.console;

    _.warn = function (msg) {
        if (console && Vue.util.warn && (!config.silent || config.debug)) {
            console.warn('[VueResource warn]: ' + msg);
        }
    };

    _.error = function (msg) {
        if (console) {
            console.error(msg);
        }
    };

    _.trim = function (str) {
        return str.replace(/^\s*|\s*$/g, '');
    };

    _.toLower = function (str) {
        return str ? str.toLowerCase() : '';
    };

    _.isString = function (value) {
        return typeof value === 'string';
    };

    _.isFunction = function (value) {
        return typeof value === 'function';
    };

    _.options = function (fn, obj, options) {

        options = options || {};

        if (_.isFunction(options)) {
            options = options.call(obj);
        }

        return _.extend(fn.bind({vm: obj, options: options}), fn, {options: options});
    };

    _.each = function (obj, iterator) {

        var i, key;

        if (typeof obj.length == 'number') {
            for (i = 0; i < obj.length; i++) {
                iterator.call(obj[i], obj[i], i);
            }
        } else if (_.isObject(obj)) {
            for (key in obj) {
                if (obj.hasOwnProperty(key)) {
                    iterator.call(obj[key], obj[key], key);
                }
            }
        }

        return obj;
    };

    _.extend = function (target) {

        var array = [], args = array.slice.call(arguments, 1), deep;

        if (typeof target == 'boolean') {
            deep = target;
            target = args.shift();
        }

        args.forEach(function (arg) {
            extend(target, arg, deep);
        });

        return target;
    };

    function extend(target, source, deep) {
        for (var key in source) {
            if (deep && (_.isPlainObject(source[key]) || _.isArray(source[key]))) {
                if (_.isPlainObject(source[key]) && !_.isPlainObject(target[key])) {
                    target[key] = {};
                }
                if (_.isArray(source[key]) && !_.isArray(target[key])) {
                    target[key] = [];
                }
                extend(target[key], source[key], deep);
            } else if (source[key] !== undefined) {
                target[key] = source[key];
            }
        }
    }

    return _;
};

},{}],18:[function(require,module,exports){
/**
 * Promise adapter.
 */

module.exports = function (_) {

    var Promise = window.Promise || require('./lib/promise')(_);

    var Adapter = function (executor) {

        if (executor instanceof Promise) {
            this.promise = executor;
        } else {
            this.promise = new Promise(executor);
        }

        this.context = undefined;
    };

    Adapter.all = function (iterable) {
        return new Adapter(Promise.all(iterable));
    };

    Adapter.resolve = function (value) {
        return new Adapter(Promise.resolve(value));
    };

    Adapter.reject = function (reason) {
        return new Adapter(Promise.reject(reason));
    };

    Adapter.race = function (iterable) {
        return new Adapter(Promise.race(iterable));
    };

    var p = Adapter.prototype;

    p.bind = function (context) {
        this.context = context;
        return this;
    };

    p.then = function (fulfilled, rejected) {

        if (fulfilled && fulfilled.bind && this.context) {
            fulfilled = fulfilled.bind(this.context);
        }

        if (rejected && rejected.bind && this.context) {
            rejected = rejected.bind(this.context);
        }

        this.promise = this.promise.then(fulfilled, rejected);

        return this;
    };

    p.catch = function (rejected) {

        if (rejected && rejected.bind && this.context) {
            rejected = rejected.bind(this.context);
        }

        this.promise = this.promise.catch(rejected);

        return this;
    };

    p.finally = function (callback) {

        return this.then(function (value) {
                callback.call(this);
                return value;
            }, function (reason) {
                callback.call(this);
                return Promise.reject(reason);
            }
        );
    };

    p.success = function (callback) {

        _.warn('The `success` method has been deprecated. Use the `then` method instead.');

        return this.then(function (response) {
            return callback.call(this, response.data, response.status, response) || response;
        });
    };

    p.error = function (callback) {

        _.warn('The `error` method has been deprecated. Use the `catch` method instead.');

        return this.catch(function (response) {
            return callback.call(this, response.data, response.status, response) || response;
        });
    };

    p.always = function (callback) {

        _.warn('The `always` method has been deprecated. Use the `finally` method instead.');

        var cb = function (response) {
            return callback.call(this, response.data, response.status, response) || response;
        };

        return this.then(cb, cb);
    };

    return Adapter;
};

},{"./lib/promise":15}],19:[function(require,module,exports){
/**
 * Service for interacting with RESTful services.
 */

module.exports = function (_) {

    function Resource(url, params, actions, options) {

        var self = this, resource = {};

        actions = _.extend({},
            Resource.actions,
            actions
        );

        _.each(actions, function (action, name) {

            action = _.extend(true, {url: url, params: params || {}}, options, action);

            resource[name] = function () {
                return (self.$http || _.http)(opts(action, arguments));
            };
        });

        return resource;
    }

    function opts(action, args) {

        var options = _.extend({}, action), params = {}, data, success, error;

        switch (args.length) {

            case 4:

                error = args[3];
                success = args[2];

            case 3:
            case 2:

                if (_.isFunction(args[1])) {

                    if (_.isFunction(args[0])) {

                        success = args[0];
                        error = args[1];

                        break;
                    }

                    success = args[1];
                    error = args[2];

                } else {

                    params = args[0];
                    data = args[1];
                    success = args[2];

                    break;
                }

            case 1:

                if (_.isFunction(args[0])) {
                    success = args[0];
                } else if (/^(POST|PUT|PATCH)$/i.test(options.method)) {
                    data = args[0];
                } else {
                    params = args[0];
                }

                break;

            case 0:

                break;

            default:

                throw 'Expected up to 4 arguments [params, data, success, error], got ' + args.length + ' arguments';
        }

        options.data = data;
        options.params = _.extend({}, options.params, params);

        if (success) {
            options.success = success;
        }

        if (error) {
            options.error = error;
        }

        return options;
    }

    Resource.actions = {

        get: {method: 'GET'},
        save: {method: 'POST'},
        query: {method: 'GET'},
        update: {method: 'PUT'},
        remove: {method: 'DELETE'},
        delete: {method: 'DELETE'}

    };

    return _.resource = Resource;
};

},{}],20:[function(require,module,exports){
/**
 * Service for URL templating.
 */

var UrlTemplate = require('./lib/url-template');

module.exports = function (_) {

    var ie = document.documentMode;
    var el = document.createElement('a');

    function Url(url, params) {

        var urlParams = Object.keys(Url.options.params), queryParams = {}, options = url, query;

        if (!_.isPlainObject(options)) {
            options = {url: url, params: params};
        }

        options = _.extend(true, {},
            Url.options, this.options, options
        );

        url = UrlTemplate.expand(options.url, options.params, urlParams);

        url = url.replace(/(\/?):([a-z]\w*)/gi, function (match, slash, name) {

            _.warn('The `:' + name + '` parameter syntax has been deprecated. Use the `{' + name + '}` syntax instead.');

            if (options.params[name]) {
                urlParams.push(name);
                return slash + encodeUriSegment(options.params[name]);
            }

            return '';
        });

        if (_.isString(options.root) && !url.match(/^(https?:)?\//)) {
            url = options.root + '/' + url;
        }

        _.each(options.params, function (value, key) {
            if (urlParams.indexOf(key) === -1) {
                queryParams[key] = value;
            }
        });

        query = Url.params(queryParams);

        if (query) {
            url += (url.indexOf('?') == -1 ? '?' : '&') + query;
        }

        return url;
    }

    /**
     * Url options.
     */

    Url.options = {
        url: '',
        root: null,
        params: {}
    };

    /**
     * Encodes a Url parameter string.
     *
     * @param {Object} obj
     */

    Url.params = function (obj) {

        var params = [];

        params.add = function (key, value) {

            if (_.isFunction (value)) {
                value = value();
            }

            if (value === null) {
                value = '';
            }

            this.push(encodeUriSegment(key) + '=' + encodeUriSegment(value));
        };

        serialize(params, obj);

        return params.join('&');
    };

    /**
     * Parse a URL and return its components.
     *
     * @param {String} url
     */

    Url.parse = function (url) {

        if (ie) {
            el.href = url;
            url = el.href;
        }

        el.href = url;

        return {
            href: el.href,
            protocol: el.protocol ? el.protocol.replace(/:$/, '') : '',
            port: el.port,
            host: el.host,
            hostname: el.hostname,
            pathname: el.pathname.charAt(0) === '/' ? el.pathname : '/' + el.pathname,
            search: el.search ? el.search.replace(/^\?/, '') : '',
            hash: el.hash ? el.hash.replace(/^#/, '') : ''
        };
    };

    function serialize(params, obj, scope) {

        var array = _.isArray(obj), plain = _.isPlainObject(obj), hash;

        _.each(obj, function (value, key) {

            hash = _.isObject(value) || _.isArray(value);

            if (scope) {
                key = scope + '[' + (plain || hash ? key : '') + ']';
            }

            if (!scope && array) {
                params.add(value.name, value.value);
            } else if (hash) {
                serialize(params, value, key);
            } else {
                params.add(key, value);
            }
        });
    }

    function encodeUriSegment(value) {

        return encodeUriQuery(value, true).
            replace(/%26/gi, '&').
            replace(/%3D/gi, '=').
            replace(/%2B/gi, '+');
    }

    function encodeUriQuery(value, spaces) {

        return encodeURIComponent(value).
            replace(/%40/gi, '@').
            replace(/%3A/gi, ':').
            replace(/%24/g, '$').
            replace(/%2C/gi, ',').
            replace(/%20/g, (spaces ? '%20' : '+'));
    }

    return _.url = Url;
};

},{"./lib/url-template":16}],21:[function(require,module,exports){
(function (process){
/*!
 * Vue.js v1.0.13
 * (c) 2015 Evan You
 * Released under the MIT License.
 */
'use strict';

function set(obj, key, val) {
  if (hasOwn(obj, key)) {
    obj[key] = val;
    return;
  }
  if (obj._isVue) {
    set(obj._data, key, val);
    return;
  }
  var ob = obj.__ob__;
  if (!ob) {
    obj[key] = val;
    return;
  }
  ob.convert(key, val);
  ob.dep.notify();
  if (ob.vms) {
    var i = ob.vms.length;
    while (i--) {
      var vm = ob.vms[i];
      vm._proxy(key);
      vm._digest();
    }
  }
  return val;
}

/**
 * Delete a property and trigger change if necessary.
 *
 * @param {Object} obj
 * @param {String} key
 */

function del(obj, key) {
  if (!hasOwn(obj, key)) {
    return;
  }
  delete obj[key];
  var ob = obj.__ob__;
  if (!ob) {
    return;
  }
  ob.dep.notify();
  if (ob.vms) {
    var i = ob.vms.length;
    while (i--) {
      var vm = ob.vms[i];
      vm._unproxy(key);
      vm._digest();
    }
  }
}

var hasOwnProperty = Object.prototype.hasOwnProperty;
/**
 * Check whether the object has the property.
 *
 * @param {Object} obj
 * @param {String} key
 * @return {Boolean}
 */

function hasOwn(obj, key) {
  return hasOwnProperty.call(obj, key);
}

/**
 * Check if an expression is a literal value.
 *
 * @param {String} exp
 * @return {Boolean}
 */

var literalValueRE = /^\s?(true|false|[\d\.]+|'[^']*'|"[^"]*")\s?$/;

function isLiteral(exp) {
  return literalValueRE.test(exp);
}

/**
 * Check if a string starts with $ or _
 *
 * @param {String} str
 * @return {Boolean}
 */

function isReserved(str) {
  var c = (str + '').charCodeAt(0);
  return c === 0x24 || c === 0x5F;
}

/**
 * Guard text output, make sure undefined outputs
 * empty string
 *
 * @param {*} value
 * @return {String}
 */

function _toString(value) {
  return value == null ? '' : value.toString();
}

/**
 * Check and convert possible numeric strings to numbers
 * before setting back to data
 *
 * @param {*} value
 * @return {*|Number}
 */

function toNumber(value) {
  if (typeof value !== 'string') {
    return value;
  } else {
    var parsed = Number(value);
    return isNaN(parsed) ? value : parsed;
  }
}

/**
 * Convert string boolean literals into real booleans.
 *
 * @param {*} value
 * @return {*|Boolean}
 */

function toBoolean(value) {
  return value === 'true' ? true : value === 'false' ? false : value;
}

/**
 * Strip quotes from a string
 *
 * @param {String} str
 * @return {String | false}
 */

function stripQuotes(str) {
  var a = str.charCodeAt(0);
  var b = str.charCodeAt(str.length - 1);
  return a === b && (a === 0x22 || a === 0x27) ? str.slice(1, -1) : str;
}

/**
 * Camelize a hyphen-delmited string.
 *
 * @param {String} str
 * @return {String}
 */

var camelizeRE = /-(\w)/g;

function camelize(str) {
  return str.replace(camelizeRE, toUpper);
}

function toUpper(_, c) {
  return c ? c.toUpperCase() : '';
}

/**
 * Hyphenate a camelCase string.
 *
 * @param {String} str
 * @return {String}
 */

var hyphenateRE = /([a-z\d])([A-Z])/g;

function hyphenate(str) {
  return str.replace(hyphenateRE, '$1-$2').toLowerCase();
}

/**
 * Converts hyphen/underscore/slash delimitered names into
 * camelized classNames.
 *
 * e.g. my-component => MyComponent
 *      some_else    => SomeElse
 *      some/comp    => SomeComp
 *
 * @param {String} str
 * @return {String}
 */

var classifyRE = /(?:^|[-_\/])(\w)/g;

function classify(str) {
  return str.replace(classifyRE, toUpper);
}

/**
 * Simple bind, faster than native
 *
 * @param {Function} fn
 * @param {Object} ctx
 * @return {Function}
 */

function bind$1(fn, ctx) {
  return function (a) {
    var l = arguments.length;
    return l ? l > 1 ? fn.apply(ctx, arguments) : fn.call(ctx, a) : fn.call(ctx);
  };
}

/**
 * Convert an Array-like object to a real Array.
 *
 * @param {Array-like} list
 * @param {Number} [start] - start index
 * @return {Array}
 */

function toArray(list, start) {
  start = start || 0;
  var i = list.length - start;
  var ret = new Array(i);
  while (i--) {
    ret[i] = list[i + start];
  }
  return ret;
}

/**
 * Mix properties into target object.
 *
 * @param {Object} to
 * @param {Object} from
 */

function extend(to, from) {
  var keys = Object.keys(from);
  var i = keys.length;
  while (i--) {
    to[keys[i]] = from[keys[i]];
  }
  return to;
}

/**
 * Quick object check - this is primarily used to tell
 * Objects from primitive values when we know the value
 * is a JSON-compliant type.
 *
 * @param {*} obj
 * @return {Boolean}
 */

function isObject(obj) {
  return obj !== null && typeof obj === 'object';
}

/**
 * Strict object type check. Only returns true
 * for plain JavaScript objects.
 *
 * @param {*} obj
 * @return {Boolean}
 */

var toString = Object.prototype.toString;
var OBJECT_STRING = '[object Object]';

function isPlainObject(obj) {
  return toString.call(obj) === OBJECT_STRING;
}

/**
 * Array type check.
 *
 * @param {*} obj
 * @return {Boolean}
 */

var isArray = Array.isArray;

/**
 * Define a non-enumerable property
 *
 * @param {Object} obj
 * @param {String} key
 * @param {*} val
 * @param {Boolean} [enumerable]
 */

function def(obj, key, val, enumerable) {
  Object.defineProperty(obj, key, {
    value: val,
    enumerable: !!enumerable,
    writable: true,
    configurable: true
  });
}

/**
 * Debounce a function so it only gets called after the
 * input stops arriving after the given wait period.
 *
 * @param {Function} func
 * @param {Number} wait
 * @return {Function} - the debounced function
 */

function _debounce(func, wait) {
  var timeout, args, context, timestamp, result;
  var later = function later() {
    var last = Date.now() - timestamp;
    if (last < wait && last >= 0) {
      timeout = setTimeout(later, wait - last);
    } else {
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    }
  };
  return function () {
    context = this;
    args = arguments;
    timestamp = Date.now();
    if (!timeout) {
      timeout = setTimeout(later, wait);
    }
    return result;
  };
}

/**
 * Manual indexOf because it's slightly faster than
 * native.
 *
 * @param {Array} arr
 * @param {*} obj
 */

function indexOf(arr, obj) {
  var i = arr.length;
  while (i--) {
    if (arr[i] === obj) return i;
  }
  return -1;
}

/**
 * Make a cancellable version of an async callback.
 *
 * @param {Function} fn
 * @return {Function}
 */

function cancellable(fn) {
  var cb = function cb() {
    if (!cb.cancelled) {
      return fn.apply(this, arguments);
    }
  };
  cb.cancel = function () {
    cb.cancelled = true;
  };
  return cb;
}

/**
 * Check if two values are loosely equal - that is,
 * if they are plain objects, do they have the same shape?
 *
 * @param {*} a
 * @param {*} b
 * @return {Boolean}
 */

function looseEqual(a, b) {
  /* eslint-disable eqeqeq */
  return a == b || (isObject(a) && isObject(b) ? JSON.stringify(a) === JSON.stringify(b) : false);
  /* eslint-enable eqeqeq */
}

var hasProto = ('__proto__' in {});

// Browser environment sniffing
var inBrowser = typeof window !== 'undefined' && Object.prototype.toString.call(window) !== '[object Object]';

var isIE9 = inBrowser && navigator.userAgent.toLowerCase().indexOf('msie 9.0') > 0;

var isAndroid = inBrowser && navigator.userAgent.toLowerCase().indexOf('android') > 0;

var transitionProp = undefined;
var transitionEndEvent = undefined;
var animationProp = undefined;
var animationEndEvent = undefined;

// Transition property/event sniffing
if (inBrowser && !isIE9) {
  var isWebkitTrans = window.ontransitionend === undefined && window.onwebkittransitionend !== undefined;
  var isWebkitAnim = window.onanimationend === undefined && window.onwebkitanimationend !== undefined;
  transitionProp = isWebkitTrans ? 'WebkitTransition' : 'transition';
  transitionEndEvent = isWebkitTrans ? 'webkitTransitionEnd' : 'transitionend';
  animationProp = isWebkitAnim ? 'WebkitAnimation' : 'animation';
  animationEndEvent = isWebkitAnim ? 'webkitAnimationEnd' : 'animationend';
}

/**
 * Defer a task to execute it asynchronously. Ideally this
 * should be executed as a microtask, so we leverage
 * MutationObserver if it's available, and fallback to
 * setTimeout(0).
 *
 * @param {Function} cb
 * @param {Object} ctx
 */

var nextTick = (function () {
  var callbacks = [];
  var pending = false;
  var timerFunc;
  function nextTickHandler() {
    pending = false;
    var copies = callbacks.slice(0);
    callbacks = [];
    for (var i = 0; i < copies.length; i++) {
      copies[i]();
    }
  }
  /* istanbul ignore if */
  if (typeof MutationObserver !== 'undefined') {
    var counter = 1;
    var observer = new MutationObserver(nextTickHandler);
    var textNode = document.createTextNode(counter);
    observer.observe(textNode, {
      characterData: true
    });
    timerFunc = function () {
      counter = (counter + 1) % 2;
      textNode.data = counter;
    };
  } else {
    timerFunc = setTimeout;
  }
  return function (cb, ctx) {
    var func = ctx ? function () {
      cb.call(ctx);
    } : cb;
    callbacks.push(func);
    if (pending) return;
    pending = true;
    timerFunc(nextTickHandler, 0);
  };
})();

function Cache(limit) {
  this.size = 0;
  this.limit = limit;
  this.head = this.tail = undefined;
  this._keymap = Object.create(null);
}

var p = Cache.prototype;

/**
 * Put <value> into the cache associated with <key>.
 * Returns the entry which was removed to make room for
 * the new entry. Otherwise undefined is returned.
 * (i.e. if there was enough room already).
 *
 * @param {String} key
 * @param {*} value
 * @return {Entry|undefined}
 */

p.put = function (key, value) {
  var entry = {
    key: key,
    value: value
  };
  this._keymap[key] = entry;
  if (this.tail) {
    this.tail.newer = entry;
    entry.older = this.tail;
  } else {
    this.head = entry;
  }
  this.tail = entry;
  if (this.size === this.limit) {
    return this.shift();
  } else {
    this.size++;
  }
};

/**
 * Purge the least recently used (oldest) entry from the
 * cache. Returns the removed entry or undefined if the
 * cache was empty.
 */

p.shift = function () {
  var entry = this.head;
  if (entry) {
    this.head = this.head.newer;
    this.head.older = undefined;
    entry.newer = entry.older = undefined;
    this._keymap[entry.key] = undefined;
  }
  return entry;
};

/**
 * Get and register recent use of <key>. Returns the value
 * associated with <key> or undefined if not in cache.
 *
 * @param {String} key
 * @param {Boolean} returnEntry
 * @return {Entry|*}
 */

p.get = function (key, returnEntry) {
  var entry = this._keymap[key];
  if (entry === undefined) return;
  if (entry === this.tail) {
    return returnEntry ? entry : entry.value;
  }
  // HEAD--------------TAIL
  //   <.older   .newer>
  //  <--- add direction --
  //   A  B  C  <D>  E
  if (entry.newer) {
    if (entry === this.head) {
      this.head = entry.newer;
    }
    entry.newer.older = entry.older; // C <-- E.
  }
  if (entry.older) {
    entry.older.newer = entry.newer; // C. --> E
  }
  entry.newer = undefined; // D --x
  entry.older = this.tail; // D. --> E
  if (this.tail) {
    this.tail.newer = entry; // E. <-- D
  }
  this.tail = entry;
  return returnEntry ? entry : entry.value;
};

var cache$1 = new Cache(1000);
var filterTokenRE = /[^\s'"]+|'[^']*'|"[^"]*"/g;
var reservedArgRE = /^in$|^-?\d+/;

/**
 * Parser state
 */

var str;
var dir;
var c;
var prev;
var i;
var l;
var lastFilterIndex;
var inSingle;
var inDouble;
var curly;
var square;
var paren;
/**
 * Push a filter to the current directive object
 */

function pushFilter() {
  var exp = str.slice(lastFilterIndex, i).trim();
  var filter;
  if (exp) {
    filter = {};
    var tokens = exp.match(filterTokenRE);
    filter.name = tokens[0];
    if (tokens.length > 1) {
      filter.args = tokens.slice(1).map(processFilterArg);
    }
  }
  if (filter) {
    (dir.filters = dir.filters || []).push(filter);
  }
  lastFilterIndex = i + 1;
}

/**
 * Check if an argument is dynamic and strip quotes.
 *
 * @param {String} arg
 * @return {Object}
 */

function processFilterArg(arg) {
  if (reservedArgRE.test(arg)) {
    return {
      value: toNumber(arg),
      dynamic: false
    };
  } else {
    var stripped = stripQuotes(arg);
    var dynamic = stripped === arg;
    return {
      value: dynamic ? arg : stripped,
      dynamic: dynamic
    };
  }
}

/**
 * Parse a directive value and extract the expression
 * and its filters into a descriptor.
 *
 * Example:
 *
 * "a + 1 | uppercase" will yield:
 * {
 *   expression: 'a + 1',
 *   filters: [
 *     { name: 'uppercase', args: null }
 *   ]
 * }
 *
 * @param {String} str
 * @return {Object}
 */

function parseDirective(s) {

  var hit = cache$1.get(s);
  if (hit) {
    return hit;
  }

  // reset parser state
  str = s;
  inSingle = inDouble = false;
  curly = square = paren = 0;
  lastFilterIndex = 0;
  dir = {};

  for (i = 0, l = str.length; i < l; i++) {
    prev = c;
    c = str.charCodeAt(i);
    if (inSingle) {
      // check single quote
      if (c === 0x27 && prev !== 0x5C) inSingle = !inSingle;
    } else if (inDouble) {
      // check double quote
      if (c === 0x22 && prev !== 0x5C) inDouble = !inDouble;
    } else if (c === 0x7C && // pipe
    str.charCodeAt(i + 1) !== 0x7C && str.charCodeAt(i - 1) !== 0x7C) {
      if (dir.expression == null) {
        // first filter, end of expression
        lastFilterIndex = i + 1;
        dir.expression = str.slice(0, i).trim();
      } else {
        // already has filter
        pushFilter();
      }
    } else {
      switch (c) {
        case 0x22:
          inDouble = true;break; // "
        case 0x27:
          inSingle = true;break; // '
        case 0x28:
          paren++;break; // (
        case 0x29:
          paren--;break; // )
        case 0x5B:
          square++;break; // [
        case 0x5D:
          square--;break; // ]
        case 0x7B:
          curly++;break; // {
        case 0x7D:
          curly--;break; // }
      }
    }
  }

  if (dir.expression == null) {
    dir.expression = str.slice(0, i).trim();
  } else if (lastFilterIndex !== 0) {
    pushFilter();
  }

  cache$1.put(s, dir);
  return dir;
}

var directive = Object.freeze({
  parseDirective: parseDirective
});

var regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g;
var cache = undefined;
var tagRE = undefined;
var htmlRE = undefined;
/**
 * Escape a string so it can be used in a RegExp
 * constructor.
 *
 * @param {String} str
 */

function escapeRegex(str) {
  return str.replace(regexEscapeRE, '\\$&');
}

function compileRegex() {
  var open = escapeRegex(config.delimiters[0]);
  var close = escapeRegex(config.delimiters[1]);
  var unsafeOpen = escapeRegex(config.unsafeDelimiters[0]);
  var unsafeClose = escapeRegex(config.unsafeDelimiters[1]);
  tagRE = new RegExp(unsafeOpen + '(.+?)' + unsafeClose + '|' + open + '(.+?)' + close, 'g');
  htmlRE = new RegExp('^' + unsafeOpen + '.*' + unsafeClose + '$');
  // reset cache
  cache = new Cache(1000);
}

/**
 * Parse a template text string into an array of tokens.
 *
 * @param {String} text
 * @return {Array<Object> | null}
 *               - {String} type
 *               - {String} value
 *               - {Boolean} [html]
 *               - {Boolean} [oneTime]
 */

function parseText(text) {
  if (!cache) {
    compileRegex();
  }
  var hit = cache.get(text);
  if (hit) {
    return hit;
  }
  text = text.replace(/\n/g, '');
  if (!tagRE.test(text)) {
    return null;
  }
  var tokens = [];
  var lastIndex = tagRE.lastIndex = 0;
  var match, index, html, value, first, oneTime;
  /* eslint-disable no-cond-assign */
  while (match = tagRE.exec(text)) {
    /* eslint-enable no-cond-assign */
    index = match.index;
    // push text token
    if (index > lastIndex) {
      tokens.push({
        value: text.slice(lastIndex, index)
      });
    }
    // tag token
    html = htmlRE.test(match[0]);
    value = html ? match[1] : match[2];
    first = value.charCodeAt(0);
    oneTime = first === 42; // *
    value = oneTime ? value.slice(1) : value;
    tokens.push({
      tag: true,
      value: value.trim(),
      html: html,
      oneTime: oneTime
    });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) {
    tokens.push({
      value: text.slice(lastIndex)
    });
  }
  cache.put(text, tokens);
  return tokens;
}

/**
 * Format a list of tokens into an expression.
 * e.g. tokens parsed from 'a {{b}} c' can be serialized
 * into one single expression as '"a " + b + " c"'.
 *
 * @param {Array} tokens
 * @return {String}
 */

function tokensToExp(tokens) {
  if (tokens.length > 1) {
    return tokens.map(function (token) {
      return formatToken(token);
    }).join('+');
  } else {
    return formatToken(tokens[0], true);
  }
}

/**
 * Format a single token.
 *
 * @param {Object} token
 * @param {Boolean} single
 * @return {String}
 */

function formatToken(token, single) {
  return token.tag ? inlineFilters(token.value, single) : '"' + token.value + '"';
}

/**
 * For an attribute with multiple interpolation tags,
 * e.g. attr="some-{{thing | filter}}", in order to combine
 * the whole thing into a single watchable expression, we
 * have to inline those filters. This function does exactly
 * that. This is a bit hacky but it avoids heavy changes
 * to directive parser and watcher mechanism.
 *
 * @param {String} exp
 * @param {Boolean} single
 * @return {String}
 */

var filterRE$1 = /[^|]\|[^|]/;
function inlineFilters(exp, single) {
  if (!filterRE$1.test(exp)) {
    return single ? exp : '(' + exp + ')';
  } else {
    var dir = parseDirective(exp);
    if (!dir.filters) {
      return '(' + exp + ')';
    } else {
      return 'this._applyFilters(' + dir.expression + // value
      ',null,' + // oldValue (null for read)
      JSON.stringify(dir.filters) + // filter descriptors
      ',false)'; // write?
    }
  }
}

var text$1 = Object.freeze({
  compileRegex: compileRegex,
  parseText: parseText,
  tokensToExp: tokensToExp
});

var delimiters = ['{{', '}}'];
var unsafeDelimiters = ['{{{', '}}}'];

var config = Object.defineProperties({

  /**
   * Whether to print debug messages.
   * Also enables stack trace for warnings.
   *
   * @type {Boolean}
   */

  debug: false,

  /**
   * Whether to suppress warnings.
   *
   * @type {Boolean}
   */

  silent: false,

  /**
   * Whether to use async rendering.
   */

  async: true,

  /**
   * Whether to warn against errors caught when evaluating
   * expressions.
   */

  warnExpressionErrors: true,

  /**
   * Whether or not to handle fully object properties which
   * are already backed by getters and seters. Depending on
   * use case and environment, this might introduce non-neglible
   * performance penalties.
   */
  convertAllProperties: false,

  /**
   * Internal flag to indicate the delimiters have been
   * changed.
   *
   * @type {Boolean}
   */

  _delimitersChanged: true,

  /**
   * List of asset types that a component can own.
   *
   * @type {Array}
   */

  _assetTypes: ['component', 'directive', 'elementDirective', 'filter', 'transition', 'partial'],

  /**
   * prop binding modes
   */

  _propBindingModes: {
    ONE_WAY: 0,
    TWO_WAY: 1,
    ONE_TIME: 2
  },

  /**
   * Max circular updates allowed in a batcher flush cycle.
   */

  _maxUpdateCount: 100

}, {
  delimiters: { /**
                 * Interpolation delimiters. Changing these would trigger
                 * the text parser to re-compile the regular expressions.
                 *
                 * @type {Array<String>}
                 */

    get: function get() {
      return delimiters;
    },
    set: function set(val) {
      delimiters = val;
      compileRegex();
    },
    configurable: true,
    enumerable: true
  },
  unsafeDelimiters: {
    get: function get() {
      return unsafeDelimiters;
    },
    set: function set(val) {
      unsafeDelimiters = val;
      compileRegex();
    },
    configurable: true,
    enumerable: true
  }
});

var warn = undefined;

if (process.env.NODE_ENV !== 'production') {
  (function () {
    var hasConsole = typeof console !== 'undefined';
    warn = function (msg, e) {
      if (hasConsole && (!config.silent || config.debug)) {
        console.warn('[Vue warn]: ' + msg);
        /* istanbul ignore if */
        if (config.debug) {
          if (e) {
            throw e;
          } else {
            console.warn(new Error('Warning Stack Trace').stack);
          }
        }
      }
    };
  })();
}

/**
 * Append with transition.
 *
 * @param {Element} el
 * @param {Element} target
 * @param {Vue} vm
 * @param {Function} [cb]
 */

function appendWithTransition(el, target, vm, cb) {
  applyTransition(el, 1, function () {
    target.appendChild(el);
  }, vm, cb);
}

/**
 * InsertBefore with transition.
 *
 * @param {Element} el
 * @param {Element} target
 * @param {Vue} vm
 * @param {Function} [cb]
 */

function beforeWithTransition(el, target, vm, cb) {
  applyTransition(el, 1, function () {
    before(el, target);
  }, vm, cb);
}

/**
 * Remove with transition.
 *
 * @param {Element} el
 * @param {Vue} vm
 * @param {Function} [cb]
 */

function removeWithTransition(el, vm, cb) {
  applyTransition(el, -1, function () {
    remove(el);
  }, vm, cb);
}

/**
 * Apply transitions with an operation callback.
 *
 * @param {Element} el
 * @param {Number} direction
 *                  1: enter
 *                 -1: leave
 * @param {Function} op - the actual DOM operation
 * @param {Vue} vm
 * @param {Function} [cb]
 */

function applyTransition(el, direction, op, vm, cb) {
  var transition = el.__v_trans;
  if (!transition ||
  // skip if there are no js hooks and CSS transition is
  // not supported
  !transition.hooks && !transitionEndEvent ||
  // skip transitions for initial compile
  !vm._isCompiled ||
  // if the vm is being manipulated by a parent directive
  // during the parent's compilation phase, skip the
  // animation.
  vm.$parent && !vm.$parent._isCompiled) {
    op();
    if (cb) cb();
    return;
  }
  var action = direction > 0 ? 'enter' : 'leave';
  transition[action](op, cb);
}

/**
 * Query an element selector if it's not an element already.
 *
 * @param {String|Element} el
 * @return {Element}
 */

function query(el) {
  if (typeof el === 'string') {
    var selector = el;
    el = document.querySelector(el);
    if (!el) {
      process.env.NODE_ENV !== 'production' && warn('Cannot find element: ' + selector);
    }
  }
  return el;
}

/**
 * Check if a node is in the document.
 * Note: document.documentElement.contains should work here
 * but always returns false for comment nodes in phantomjs,
 * making unit tests difficult. This is fixed by doing the
 * contains() check on the node's parentNode instead of
 * the node itself.
 *
 * @param {Node} node
 * @return {Boolean}
 */

function inDoc(node) {
  var doc = document.documentElement;
  var parent = node && node.parentNode;
  return doc === node || doc === parent || !!(parent && parent.nodeType === 1 && doc.contains(parent));
}

/**
 * Get and remove an attribute from a node.
 *
 * @param {Node} node
 * @param {String} _attr
 */

function getAttr(node, _attr) {
  var val = node.getAttribute(_attr);
  if (val !== null) {
    node.removeAttribute(_attr);
  }
  return val;
}

/**
 * Get an attribute with colon or v-bind: prefix.
 *
 * @param {Node} node
 * @param {String} name
 * @return {String|null}
 */

function getBindAttr(node, name) {
  var val = getAttr(node, ':' + name);
  if (val === null) {
    val = getAttr(node, 'v-bind:' + name);
  }
  return val;
}

/**
 * Check the presence of a bind attribute.
 *
 * @param {Node} node
 * @param {String} name
 * @return {Boolean}
 */

function hasBindAttr(node, name) {
  return node.hasAttribute(name) || node.hasAttribute(':' + name) || node.hasAttribute('v-bind:' + name);
}

/**
 * Insert el before target
 *
 * @param {Element} el
 * @param {Element} target
 */

function before(el, target) {
  target.parentNode.insertBefore(el, target);
}

/**
 * Insert el after target
 *
 * @param {Element} el
 * @param {Element} target
 */

function after(el, target) {
  if (target.nextSibling) {
    before(el, target.nextSibling);
  } else {
    target.parentNode.appendChild(el);
  }
}

/**
 * Remove el from DOM
 *
 * @param {Element} el
 */

function remove(el) {
  el.parentNode.removeChild(el);
}

/**
 * Prepend el to target
 *
 * @param {Element} el
 * @param {Element} target
 */

function prepend(el, target) {
  if (target.firstChild) {
    before(el, target.firstChild);
  } else {
    target.appendChild(el);
  }
}

/**
 * Replace target with el
 *
 * @param {Element} target
 * @param {Element} el
 */

function replace(target, el) {
  var parent = target.parentNode;
  if (parent) {
    parent.replaceChild(el, target);
  }
}

/**
 * Add event listener shorthand.
 *
 * @param {Element} el
 * @param {String} event
 * @param {Function} cb
 */

function on$1(el, event, cb) {
  el.addEventListener(event, cb);
}

/**
 * Remove event listener shorthand.
 *
 * @param {Element} el
 * @param {String} event
 * @param {Function} cb
 */

function off(el, event, cb) {
  el.removeEventListener(event, cb);
}

/**
 * In IE9, setAttribute('class') will result in empty class
 * if the element also has the :class attribute; However in
 * PhantomJS, setting `className` does not work on SVG elements...
 * So we have to do a conditional check here.
 *
 * @param {Element} el
 * @param {String} cls
 */

function setClass(el, cls) {
  /* istanbul ignore if */
  if (isIE9 && !(el instanceof SVGElement)) {
    el.className = cls;
  } else {
    el.setAttribute('class', cls);
  }
}

/**
 * Add class with compatibility for IE & SVG
 *
 * @param {Element} el
 * @param {String} cls
 */

function addClass(el, cls) {
  if (el.classList) {
    el.classList.add(cls);
  } else {
    var cur = ' ' + (el.getAttribute('class') || '') + ' ';
    if (cur.indexOf(' ' + cls + ' ') < 0) {
      setClass(el, (cur + cls).trim());
    }
  }
}

/**
 * Remove class with compatibility for IE & SVG
 *
 * @param {Element} el
 * @param {String} cls
 */

function removeClass(el, cls) {
  if (el.classList) {
    el.classList.remove(cls);
  } else {
    var cur = ' ' + (el.getAttribute('class') || '') + ' ';
    var tar = ' ' + cls + ' ';
    while (cur.indexOf(tar) >= 0) {
      cur = cur.replace(tar, ' ');
    }
    setClass(el, cur.trim());
  }
  if (!el.className) {
    el.removeAttribute('class');
  }
}

/**
 * Extract raw content inside an element into a temporary
 * container div
 *
 * @param {Element} el
 * @param {Boolean} asFragment
 * @return {Element}
 */

function extractContent(el, asFragment) {
  var child;
  var rawContent;
  /* istanbul ignore if */
  if (isTemplate(el) && el.content instanceof DocumentFragment) {
    el = el.content;
  }
  if (el.hasChildNodes()) {
    trimNode(el);
    rawContent = asFragment ? document.createDocumentFragment() : document.createElement('div');
    /* eslint-disable no-cond-assign */
    while (child = el.firstChild) {
      /* eslint-enable no-cond-assign */
      rawContent.appendChild(child);
    }
  }
  return rawContent;
}

/**
 * Trim possible empty head/tail textNodes inside a parent.
 *
 * @param {Node} node
 */

function trimNode(node) {
  trim(node, node.firstChild);
  trim(node, node.lastChild);
}

function trim(parent, node) {
  if (node && node.nodeType === 3 && !node.data.trim()) {
    parent.removeChild(node);
  }
}

/**
 * Check if an element is a template tag.
 * Note if the template appears inside an SVG its tagName
 * will be in lowercase.
 *
 * @param {Element} el
 */

function isTemplate(el) {
  return el.tagName && el.tagName.toLowerCase() === 'template';
}

/**
 * Create an "anchor" for performing dom insertion/removals.
 * This is used in a number of scenarios:
 * - fragment instance
 * - v-html
 * - v-if
 * - v-for
 * - component
 *
 * @param {String} content
 * @param {Boolean} persist - IE trashes empty textNodes on
 *                            cloneNode(true), so in certain
 *                            cases the anchor needs to be
 *                            non-empty to be persisted in
 *                            templates.
 * @return {Comment|Text}
 */

function createAnchor(content, persist) {
  var anchor = config.debug ? document.createComment(content) : document.createTextNode(persist ? ' ' : '');
  anchor.__vue_anchor = true;
  return anchor;
}

/**
 * Find a component ref attribute that starts with $.
 *
 * @param {Element} node
 * @return {String|undefined}
 */

var refRE = /^v-ref:/;

function findRef(node) {
  if (node.hasAttributes()) {
    var attrs = node.attributes;
    for (var i = 0, l = attrs.length; i < l; i++) {
      var name = attrs[i].name;
      if (refRE.test(name)) {
        return camelize(name.replace(refRE, ''));
      }
    }
  }
}

/**
 * Map a function to a range of nodes .
 *
 * @param {Node} node
 * @param {Node} end
 * @param {Function} op
 */

function mapNodeRange(node, end, op) {
  var next;
  while (node !== end) {
    next = node.nextSibling;
    op(node);
    node = next;
  }
  op(end);
}

/**
 * Remove a range of nodes with transition, store
 * the nodes in a fragment with correct ordering,
 * and call callback when done.
 *
 * @param {Node} start
 * @param {Node} end
 * @param {Vue} vm
 * @param {DocumentFragment} frag
 * @param {Function} cb
 */

function removeNodeRange(start, end, vm, frag, cb) {
  var done = false;
  var removed = 0;
  var nodes = [];
  mapNodeRange(start, end, function (node) {
    if (node === end) done = true;
    nodes.push(node);
    removeWithTransition(node, vm, onRemoved);
  });
  function onRemoved() {
    removed++;
    if (done && removed >= nodes.length) {
      for (var i = 0; i < nodes.length; i++) {
        frag.appendChild(nodes[i]);
      }
      cb && cb();
    }
  }
}

var commonTagRE = /^(div|p|span|img|a|b|i|br|ul|ol|li|h1|h2|h3|h4|h5|h6|code|pre|table|th|td|tr|form|label|input|select|option|nav|article|section|header|footer)$/;
var reservedTagRE = /^(slot|partial|component)$/;

/**
 * Check if an element is a component, if yes return its
 * component id.
 *
 * @param {Element} el
 * @param {Object} options
 * @return {Object|undefined}
 */

function checkComponentAttr(el, options) {
  var tag = el.tagName.toLowerCase();
  var hasAttrs = el.hasAttributes();
  if (!commonTagRE.test(tag) && !reservedTagRE.test(tag)) {
    if (resolveAsset(options, 'components', tag)) {
      return { id: tag };
    } else {
      var is = hasAttrs && getIsBinding(el);
      if (is) {
        return is;
      } else if (process.env.NODE_ENV !== 'production') {
        if (tag.indexOf('-') > -1 || /HTMLUnknownElement/.test(el.toString()) &&
        // Chrome returns unknown for several HTML5 elements.
        // https://code.google.com/p/chromium/issues/detail?id=540526
        !/^(data|time|rtc|rb)$/.test(tag)) {
          warn('Unknown custom element: <' + tag + '> - did you ' + 'register the component correctly?');
        }
      }
    }
  } else if (hasAttrs) {
    return getIsBinding(el);
  }
}

/**
 * Get "is" binding from an element.
 *
 * @param {Element} el
 * @return {Object|undefined}
 */

function getIsBinding(el) {
  // dynamic syntax
  var exp = getAttr(el, 'is');
  if (exp != null) {
    return { id: exp };
  } else {
    exp = getBindAttr(el, 'is');
    if (exp != null) {
      return { id: exp, dynamic: true };
    }
  }
}

/**
 * Set a prop's initial value on a vm and its data object.
 *
 * @param {Vue} vm
 * @param {Object} prop
 * @param {*} value
 */

function initProp(vm, prop, value) {
  var key = prop.path;
  value = coerceProp(prop, value);
  vm[key] = vm._data[key] = assertProp(prop, value) ? value : undefined;
}

/**
 * Assert whether a prop is valid.
 *
 * @param {Object} prop
 * @param {*} value
 */

function assertProp(prop, value) {
  // if a prop is not provided and is not required,
  // skip the check.
  if (prop.raw === null && !prop.required) {
    return true;
  }
  var options = prop.options;
  var type = options.type;
  var valid = true;
  var expectedType;
  if (type) {
    if (type === String) {
      expectedType = 'string';
      valid = typeof value === expectedType;
    } else if (type === Number) {
      expectedType = 'number';
      valid = typeof value === 'number';
    } else if (type === Boolean) {
      expectedType = 'boolean';
      valid = typeof value === 'boolean';
    } else if (type === Function) {
      expectedType = 'function';
      valid = typeof value === 'function';
    } else if (type === Object) {
      expectedType = 'object';
      valid = isPlainObject(value);
    } else if (type === Array) {
      expectedType = 'array';
      valid = isArray(value);
    } else {
      valid = value instanceof type;
    }
  }
  if (!valid) {
    process.env.NODE_ENV !== 'production' && warn('Invalid prop: type check failed for ' + prop.path + '="' + prop.raw + '".' + ' Expected ' + formatType(expectedType) + ', got ' + formatValue(value) + '.');
    return false;
  }
  var validator = options.validator;
  if (validator) {
    if (!validator.call(null, value)) {
      process.env.NODE_ENV !== 'production' && warn('Invalid prop: custom validator check failed for ' + prop.path + '="' + prop.raw + '"');
      return false;
    }
  }
  return true;
}

/**
 * Force parsing value with coerce option.
 *
 * @param {*} value
 * @param {Object} options
 * @return {*}
 */

function coerceProp(prop, value) {
  var coerce = prop.options.coerce;
  if (!coerce) {
    return value;
  }
  // coerce is a function
  return coerce(value);
}

function formatType(val) {
  return val ? val.charAt(0).toUpperCase() + val.slice(1) : 'custom type';
}

function formatValue(val) {
  return Object.prototype.toString.call(val).slice(8, -1);
}

/**
 * Option overwriting strategies are functions that handle
 * how to merge a parent option value and a child option
 * value into the final value.
 *
 * All strategy functions follow the same signature:
 *
 * @param {*} parentVal
 * @param {*} childVal
 * @param {Vue} [vm]
 */

var strats = config.optionMergeStrategies = Object.create(null);

/**
 * Helper that recursively merges two data objects together.
 */

function mergeData(to, from) {
  var key, toVal, fromVal;
  for (key in from) {
    toVal = to[key];
    fromVal = from[key];
    if (!hasOwn(to, key)) {
      set(to, key, fromVal);
    } else if (isObject(toVal) && isObject(fromVal)) {
      mergeData(toVal, fromVal);
    }
  }
  return to;
}

/**
 * Data
 */

strats.data = function (parentVal, childVal, vm) {
  if (!vm) {
    // in a Vue.extend merge, both should be functions
    if (!childVal) {
      return parentVal;
    }
    if (typeof childVal !== 'function') {
      process.env.NODE_ENV !== 'production' && warn('The "data" option should be a function ' + 'that returns a per-instance value in component ' + 'definitions.');
      return parentVal;
    }
    if (!parentVal) {
      return childVal;
    }
    // when parentVal & childVal are both present,
    // we need to return a function that returns the
    // merged result of both functions... no need to
    // check if parentVal is a function here because
    // it has to be a function to pass previous merges.
    return function mergedDataFn() {
      return mergeData(childVal.call(this), parentVal.call(this));
    };
  } else if (parentVal || childVal) {
    return function mergedInstanceDataFn() {
      // instance merge
      var instanceData = typeof childVal === 'function' ? childVal.call(vm) : childVal;
      var defaultData = typeof parentVal === 'function' ? parentVal.call(vm) : undefined;
      if (instanceData) {
        return mergeData(instanceData, defaultData);
      } else {
        return defaultData;
      }
    };
  }
};

/**
 * El
 */

strats.el = function (parentVal, childVal, vm) {
  if (!vm && childVal && typeof childVal !== 'function') {
    process.env.NODE_ENV !== 'production' && warn('The "el" option should be a function ' + 'that returns a per-instance value in component ' + 'definitions.');
    return;
  }
  var ret = childVal || parentVal;
  // invoke the element factory if this is instance merge
  return vm && typeof ret === 'function' ? ret.call(vm) : ret;
};

/**
 * Hooks and param attributes are merged as arrays.
 */

strats.init = strats.created = strats.ready = strats.attached = strats.detached = strats.beforeCompile = strats.compiled = strats.beforeDestroy = strats.destroyed = function (parentVal, childVal) {
  return childVal ? parentVal ? parentVal.concat(childVal) : isArray(childVal) ? childVal : [childVal] : parentVal;
};

/**
 * 0.11 deprecation warning
 */

strats.paramAttributes = function () {
  /* istanbul ignore next */
  process.env.NODE_ENV !== 'production' && warn('"paramAttributes" option has been deprecated in 0.12. ' + 'Use "props" instead.');
};

/**
 * Assets
 *
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 */

function mergeAssets(parentVal, childVal) {
  var res = Object.create(parentVal);
  return childVal ? extend(res, guardArrayAssets(childVal)) : res;
}

config._assetTypes.forEach(function (type) {
  strats[type + 's'] = mergeAssets;
});

/**
 * Events & Watchers.
 *
 * Events & watchers hashes should not overwrite one
 * another, so we merge them as arrays.
 */

strats.watch = strats.events = function (parentVal, childVal) {
  if (!childVal) return parentVal;
  if (!parentVal) return childVal;
  var ret = {};
  extend(ret, parentVal);
  for (var key in childVal) {
    var parent = ret[key];
    var child = childVal[key];
    if (parent && !isArray(parent)) {
      parent = [parent];
    }
    ret[key] = parent ? parent.concat(child) : [child];
  }
  return ret;
};

/**
 * Other object hashes.
 */

strats.props = strats.methods = strats.computed = function (parentVal, childVal) {
  if (!childVal) return parentVal;
  if (!parentVal) return childVal;
  var ret = Object.create(null);
  extend(ret, parentVal);
  extend(ret, childVal);
  return ret;
};

/**
 * Default strategy.
 */

var defaultStrat = function defaultStrat(parentVal, childVal) {
  return childVal === undefined ? parentVal : childVal;
};

/**
 * Make sure component options get converted to actual
 * constructors.
 *
 * @param {Object} options
 */

function guardComponents(options) {
  if (options.components) {
    var components = options.components = guardArrayAssets(options.components);
    var def;
    var ids = Object.keys(components);
    for (var i = 0, l = ids.length; i < l; i++) {
      var key = ids[i];
      if (commonTagRE.test(key) || reservedTagRE.test(key)) {
        process.env.NODE_ENV !== 'production' && warn('Do not use built-in or reserved HTML elements as component ' + 'id: ' + key);
        continue;
      }
      def = components[key];
      if (isPlainObject(def)) {
        components[key] = Vue.extend(def);
      }
    }
  }
}

/**
 * Ensure all props option syntax are normalized into the
 * Object-based format.
 *
 * @param {Object} options
 */

function guardProps(options) {
  var props = options.props;
  var i, val;
  if (isArray(props)) {
    options.props = {};
    i = props.length;
    while (i--) {
      val = props[i];
      if (typeof val === 'string') {
        options.props[val] = null;
      } else if (val.name) {
        options.props[val.name] = val;
      }
    }
  } else if (isPlainObject(props)) {
    var keys = Object.keys(props);
    i = keys.length;
    while (i--) {
      val = props[keys[i]];
      if (typeof val === 'function') {
        props[keys[i]] = { type: val };
      }
    }
  }
}

/**
 * Guard an Array-format assets option and converted it
 * into the key-value Object format.
 *
 * @param {Object|Array} assets
 * @return {Object}
 */

function guardArrayAssets(assets) {
  if (isArray(assets)) {
    var res = {};
    var i = assets.length;
    var asset;
    while (i--) {
      asset = assets[i];
      var id = typeof asset === 'function' ? asset.options && asset.options.name || asset.id : asset.name || asset.id;
      if (!id) {
        process.env.NODE_ENV !== 'production' && warn('Array-syntax assets must provide a "name" or "id" field.');
      } else {
        res[id] = asset;
      }
    }
    return res;
  }
  return assets;
}

/**
 * Merge two option objects into a new one.
 * Core utility used in both instantiation and inheritance.
 *
 * @param {Object} parent
 * @param {Object} child
 * @param {Vue} [vm] - if vm is present, indicates this is
 *                     an instantiation merge.
 */

function mergeOptions(parent, child, vm) {
  guardComponents(child);
  guardProps(child);
  var options = {};
  var key;
  if (child.mixins) {
    for (var i = 0, l = child.mixins.length; i < l; i++) {
      parent = mergeOptions(parent, child.mixins[i], vm);
    }
  }
  for (key in parent) {
    mergeField(key);
  }
  for (key in child) {
    if (!hasOwn(parent, key)) {
      mergeField(key);
    }
  }
  function mergeField(key) {
    var strat = strats[key] || defaultStrat;
    options[key] = strat(parent[key], child[key], vm, key);
  }
  return options;
}

/**
 * Resolve an asset.
 * This function is used because child instances need access
 * to assets defined in its ancestor chain.
 *
 * @param {Object} options
 * @param {String} type
 * @param {String} id
 * @return {Object|Function}
 */

function resolveAsset(options, type, id) {
  var assets = options[type];
  var camelizedId;
  return assets[id] ||
  // camelCase ID
  assets[camelizedId = camelize(id)] ||
  // Pascal Case ID
  assets[camelizedId.charAt(0).toUpperCase() + camelizedId.slice(1)];
}

/**
 * Assert asset exists
 */

function assertAsset(val, type, id) {
  if (!val) {
    process.env.NODE_ENV !== 'production' && warn('Failed to resolve ' + type + ': ' + id);
  }
}

var arrayProto = Array.prototype;
var arrayMethods = Object.create(arrayProto)

/**
 * Intercept mutating methods and emit events
 */

;['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'].forEach(function (method) {
  // cache original method
  var original = arrayProto[method];
  def(arrayMethods, method, function mutator() {
    // avoid leaking arguments:
    // http://jsperf.com/closure-with-arguments
    var i = arguments.length;
    var args = new Array(i);
    while (i--) {
      args[i] = arguments[i];
    }
    var result = original.apply(this, args);
    var ob = this.__ob__;
    var inserted;
    switch (method) {
      case 'push':
        inserted = args;
        break;
      case 'unshift':
        inserted = args;
        break;
      case 'splice':
        inserted = args.slice(2);
        break;
    }
    if (inserted) ob.observeArray(inserted);
    // notify change
    ob.dep.notify();
    return result;
  });
});

/**
 * Swap the element at the given index with a new value
 * and emits corresponding event.
 *
 * @param {Number} index
 * @param {*} val
 * @return {*} - replaced element
 */

def(arrayProto, '$set', function $set(index, val) {
  if (index >= this.length) {
    this.length = Number(index) + 1;
  }
  return this.splice(index, 1, val)[0];
});

/**
 * Convenience method to remove the element at given index.
 *
 * @param {Number} index
 * @param {*} val
 */

def(arrayProto, '$remove', function $remove(item) {
  /* istanbul ignore if */
  if (!this.length) return;
  var index = indexOf(this, item);
  if (index > -1) {
    return this.splice(index, 1);
  }
});

var uid$3 = 0;

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 *
 * @constructor
 */
function Dep() {
  this.id = uid$3++;
  this.subs = [];
}

// the current target watcher being evaluated.
// this is globally unique because there could be only one
// watcher being evaluated at any time.
Dep.target = null;

/**
 * Add a directive subscriber.
 *
 * @param {Directive} sub
 */

Dep.prototype.addSub = function (sub) {
  this.subs.push(sub);
};

/**
 * Remove a directive subscriber.
 *
 * @param {Directive} sub
 */

Dep.prototype.removeSub = function (sub) {
  this.subs.$remove(sub);
};

/**
 * Add self as a dependency to the target watcher.
 */

Dep.prototype.depend = function () {
  Dep.target.addDep(this);
};

/**
 * Notify all subscribers of a new value.
 */

Dep.prototype.notify = function () {
  // stablize the subscriber list first
  var subs = toArray(this.subs);
  for (var i = 0, l = subs.length; i < l; i++) {
    subs[i].update();
  }
};

var arrayKeys = Object.getOwnPropertyNames(arrayMethods);

/**
 * Observer class that are attached to each observed
 * object. Once attached, the observer converts target
 * object's property keys into getter/setters that
 * collect dependencies and dispatches updates.
 *
 * @param {Array|Object} value
 * @constructor
 */

function Observer(value) {
  this.value = value;
  this.dep = new Dep();
  def(value, '__ob__', this);
  if (isArray(value)) {
    var augment = hasProto ? protoAugment : copyAugment;
    augment(value, arrayMethods, arrayKeys);
    this.observeArray(value);
  } else {
    this.walk(value);
  }
}

// Instance methods

/**
 * Walk through each property and convert them into
 * getter/setters. This method should only be called when
 * value type is Object.
 *
 * @param {Object} obj
 */

Observer.prototype.walk = function (obj) {
  var keys = Object.keys(obj);
  for (var i = 0, l = keys.length; i < l; i++) {
    this.convert(keys[i], obj[keys[i]]);
  }
};

/**
 * Observe a list of Array items.
 *
 * @param {Array} items
 */

Observer.prototype.observeArray = function (items) {
  for (var i = 0, l = items.length; i < l; i++) {
    observe(items[i]);
  }
};

/**
 * Convert a property into getter/setter so we can emit
 * the events when the property is accessed/changed.
 *
 * @param {String} key
 * @param {*} val
 */

Observer.prototype.convert = function (key, val) {
  defineReactive(this.value, key, val);
};

/**
 * Add an owner vm, so that when $set/$delete mutations
 * happen we can notify owner vms to proxy the keys and
 * digest the watchers. This is only called when the object
 * is observed as an instance's root $data.
 *
 * @param {Vue} vm
 */

Observer.prototype.addVm = function (vm) {
  (this.vms || (this.vms = [])).push(vm);
};

/**
 * Remove an owner vm. This is called when the object is
 * swapped out as an instance's $data object.
 *
 * @param {Vue} vm
 */

Observer.prototype.removeVm = function (vm) {
  this.vms.$remove(vm);
};

// helpers

/**
 * Augment an target Object or Array by intercepting
 * the prototype chain using __proto__
 *
 * @param {Object|Array} target
 * @param {Object} proto
 */

function protoAugment(target, src) {
  target.__proto__ = src;
}

/**
 * Augment an target Object or Array by defining
 * hidden properties.
 *
 * @param {Object|Array} target
 * @param {Object} proto
 */

function copyAugment(target, src, keys) {
  for (var i = 0, l = keys.length; i < l; i++) {
    var key = keys[i];
    def(target, key, src[key]);
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 *
 * @param {*} value
 * @param {Vue} [vm]
 * @return {Observer|undefined}
 * @static
 */

function observe(value, vm) {
  if (!value || typeof value !== 'object') {
    return;
  }
  var ob;
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__;
  } else if ((isArray(value) || isPlainObject(value)) && Object.isExtensible(value) && !value._isVue) {
    ob = new Observer(value);
  }
  if (ob && vm) {
    ob.addVm(vm);
  }
  return ob;
}

/**
 * Define a reactive property on an Object.
 *
 * @param {Object} obj
 * @param {String} key
 * @param {*} val
 */

function defineReactive(obj, key, val) {
  var dep = new Dep();

  // cater for pre-defined getter/setters
  var getter, setter;
  if (config.convertAllProperties) {
    var property = Object.getOwnPropertyDescriptor(obj, key);
    if (property && property.configurable === false) {
      return;
    }
    getter = property && property.get;
    setter = property && property.set;
  }

  var childOb = observe(val);
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter() {
      var value = getter ? getter.call(obj) : val;
      if (Dep.target) {
        dep.depend();
        if (childOb) {
          childOb.dep.depend();
        }
        if (isArray(value)) {
          for (var e, i = 0, l = value.length; i < l; i++) {
            e = value[i];
            e && e.__ob__ && e.__ob__.dep.depend();
          }
        }
      }
      return value;
    },
    set: function reactiveSetter(newVal) {
      var value = getter ? getter.call(obj) : val;
      if (newVal === value) {
        return;
      }
      if (setter) {
        setter.call(obj, newVal);
      } else {
        val = newVal;
      }
      childOb = observe(newVal);
      dep.notify();
    }
  });
}

var util = Object.freeze({
	defineReactive: defineReactive,
	set: set,
	del: del,
	hasOwn: hasOwn,
	isLiteral: isLiteral,
	isReserved: isReserved,
	_toString: _toString,
	toNumber: toNumber,
	toBoolean: toBoolean,
	stripQuotes: stripQuotes,
	camelize: camelize,
	hyphenate: hyphenate,
	classify: classify,
	bind: bind$1,
	toArray: toArray,
	extend: extend,
	isObject: isObject,
	isPlainObject: isPlainObject,
	def: def,
	debounce: _debounce,
	indexOf: indexOf,
	cancellable: cancellable,
	looseEqual: looseEqual,
	isArray: isArray,
	hasProto: hasProto,
	inBrowser: inBrowser,
	isIE9: isIE9,
	isAndroid: isAndroid,
	get transitionProp () { return transitionProp; },
	get transitionEndEvent () { return transitionEndEvent; },
	get animationProp () { return animationProp; },
	get animationEndEvent () { return animationEndEvent; },
	nextTick: nextTick,
	query: query,
	inDoc: inDoc,
	getAttr: getAttr,
	getBindAttr: getBindAttr,
	hasBindAttr: hasBindAttr,
	before: before,
	after: after,
	remove: remove,
	prepend: prepend,
	replace: replace,
	on: on$1,
	off: off,
	setClass: setClass,
	addClass: addClass,
	removeClass: removeClass,
	extractContent: extractContent,
	trimNode: trimNode,
	isTemplate: isTemplate,
	createAnchor: createAnchor,
	findRef: findRef,
	mapNodeRange: mapNodeRange,
	removeNodeRange: removeNodeRange,
	mergeOptions: mergeOptions,
	resolveAsset: resolveAsset,
	assertAsset: assertAsset,
	checkComponentAttr: checkComponentAttr,
	initProp: initProp,
	assertProp: assertProp,
	coerceProp: coerceProp,
	commonTagRE: commonTagRE,
	reservedTagRE: reservedTagRE,
	get warn () { return warn; }
});

var uid = 0;

function initMixin (Vue) {

  /**
   * The main init sequence. This is called for every
   * instance, including ones that are created from extended
   * constructors.
   *
   * @param {Object} options - this options object should be
   *                           the result of merging class
   *                           options and the options passed
   *                           in to the constructor.
   */

  Vue.prototype._init = function (options) {

    options = options || {};

    this.$el = null;
    this.$parent = options.parent;
    this.$root = this.$parent ? this.$parent.$root : this;
    this.$children = [];
    this.$refs = {}; // child vm references
    this.$els = {}; // element references
    this._watchers = []; // all watchers as an array
    this._directives = []; // all directives

    // a uid
    this._uid = uid++;

    // a flag to avoid this being observed
    this._isVue = true;

    // events bookkeeping
    this._events = {}; // registered callbacks
    this._eventsCount = {}; // for $broadcast optimization

    // fragment instance properties
    this._isFragment = false;
    this._fragment = // @type {DocumentFragment}
    this._fragmentStart = // @type {Text|Comment}
    this._fragmentEnd = null; // @type {Text|Comment}

    // lifecycle state
    this._isCompiled = this._isDestroyed = this._isReady = this._isAttached = this._isBeingDestroyed = false;
    this._unlinkFn = null;

    // context:
    // if this is a transcluded component, context
    // will be the common parent vm of this instance
    // and its host.
    this._context = options._context || this.$parent;

    // scope:
    // if this is inside an inline v-for, the scope
    // will be the intermediate scope created for this
    // repeat fragment. this is used for linking props
    // and container directives.
    this._scope = options._scope;

    // fragment:
    // if this instance is compiled inside a Fragment, it
    // needs to reigster itself as a child of that fragment
    // for attach/detach to work properly.
    this._frag = options._frag;
    if (this._frag) {
      this._frag.children.push(this);
    }

    // push self into parent / transclusion host
    if (this.$parent) {
      this.$parent.$children.push(this);
    }

    // merge options.
    options = this.$options = mergeOptions(this.constructor.options, options, this);

    // set ref
    this._updateRef();

    // initialize data as empty object.
    // it will be filled up in _initScope().
    this._data = {};

    // call init hook
    this._callHook('init');

    // initialize data observation and scope inheritance.
    this._initState();

    // setup event system and option events.
    this._initEvents();

    // call created hook
    this._callHook('created');

    // if `el` option is passed, start compilation.
    if (options.el) {
      this.$mount(options.el);
    }
  };
}

var pathCache = new Cache(1000);

// actions
var APPEND = 0;
var PUSH = 1;
var INC_SUB_PATH_DEPTH = 2;
var PUSH_SUB_PATH = 3;

// states
var BEFORE_PATH = 0;
var IN_PATH = 1;
var BEFORE_IDENT = 2;
var IN_IDENT = 3;
var IN_SUB_PATH = 4;
var IN_SINGLE_QUOTE = 5;
var IN_DOUBLE_QUOTE = 6;
var AFTER_PATH = 7;
var ERROR = 8;

var pathStateMachine = [];

pathStateMachine[BEFORE_PATH] = {
  'ws': [BEFORE_PATH],
  'ident': [IN_IDENT, APPEND],
  '[': [IN_SUB_PATH],
  'eof': [AFTER_PATH]
};

pathStateMachine[IN_PATH] = {
  'ws': [IN_PATH],
  '.': [BEFORE_IDENT],
  '[': [IN_SUB_PATH],
  'eof': [AFTER_PATH]
};

pathStateMachine[BEFORE_IDENT] = {
  'ws': [BEFORE_IDENT],
  'ident': [IN_IDENT, APPEND]
};

pathStateMachine[IN_IDENT] = {
  'ident': [IN_IDENT, APPEND],
  '0': [IN_IDENT, APPEND],
  'number': [IN_IDENT, APPEND],
  'ws': [IN_PATH, PUSH],
  '.': [BEFORE_IDENT, PUSH],
  '[': [IN_SUB_PATH, PUSH],
  'eof': [AFTER_PATH, PUSH]
};

pathStateMachine[IN_SUB_PATH] = {
  "'": [IN_SINGLE_QUOTE, APPEND],
  '"': [IN_DOUBLE_QUOTE, APPEND],
  '[': [IN_SUB_PATH, INC_SUB_PATH_DEPTH],
  ']': [IN_PATH, PUSH_SUB_PATH],
  'eof': ERROR,
  'else': [IN_SUB_PATH, APPEND]
};

pathStateMachine[IN_SINGLE_QUOTE] = {
  "'": [IN_SUB_PATH, APPEND],
  'eof': ERROR,
  'else': [IN_SINGLE_QUOTE, APPEND]
};

pathStateMachine[IN_DOUBLE_QUOTE] = {
  '"': [IN_SUB_PATH, APPEND],
  'eof': ERROR,
  'else': [IN_DOUBLE_QUOTE, APPEND]
};

/**
 * Determine the type of a character in a keypath.
 *
 * @param {Char} ch
 * @return {String} type
 */

function getPathCharType(ch) {
  if (ch === undefined) {
    return 'eof';
  }

  var code = ch.charCodeAt(0);

  switch (code) {
    case 0x5B: // [
    case 0x5D: // ]
    case 0x2E: // .
    case 0x22: // "
    case 0x27: // '
    case 0x30:
      // 0
      return ch;

    case 0x5F: // _
    case 0x24:
      // $
      return 'ident';

    case 0x20: // Space
    case 0x09: // Tab
    case 0x0A: // Newline
    case 0x0D: // Return
    case 0xA0: // No-break space
    case 0xFEFF: // Byte Order Mark
    case 0x2028: // Line Separator
    case 0x2029:
      // Paragraph Separator
      return 'ws';
  }

  // a-z, A-Z
  if (code >= 0x61 && code <= 0x7A || code >= 0x41 && code <= 0x5A) {
    return 'ident';
  }

  // 1-9
  if (code >= 0x31 && code <= 0x39) {
    return 'number';
  }

  return 'else';
}

/**
 * Format a subPath, return its plain form if it is
 * a literal string or number. Otherwise prepend the
 * dynamic indicator (*).
 *
 * @param {String} path
 * @return {String}
 */

function formatSubPath(path) {
  var trimmed = path.trim();
  // invalid leading 0
  if (path.charAt(0) === '0' && isNaN(path)) {
    return false;
  }
  return isLiteral(trimmed) ? stripQuotes(trimmed) : '*' + trimmed;
}

/**
 * Parse a string path into an array of segments
 *
 * @param {String} path
 * @return {Array|undefined}
 */

function parse(path) {
  var keys = [];
  var index = -1;
  var mode = BEFORE_PATH;
  var subPathDepth = 0;
  var c, newChar, key, type, transition, action, typeMap;

  var actions = [];

  actions[PUSH] = function () {
    if (key !== undefined) {
      keys.push(key);
      key = undefined;
    }
  };

  actions[APPEND] = function () {
    if (key === undefined) {
      key = newChar;
    } else {
      key += newChar;
    }
  };

  actions[INC_SUB_PATH_DEPTH] = function () {
    actions[APPEND]();
    subPathDepth++;
  };

  actions[PUSH_SUB_PATH] = function () {
    if (subPathDepth > 0) {
      subPathDepth--;
      mode = IN_SUB_PATH;
      actions[APPEND]();
    } else {
      subPathDepth = 0;
      key = formatSubPath(key);
      if (key === false) {
        return false;
      } else {
        actions[PUSH]();
      }
    }
  };

  function maybeUnescapeQuote() {
    var nextChar = path[index + 1];
    if (mode === IN_SINGLE_QUOTE && nextChar === "'" || mode === IN_DOUBLE_QUOTE && nextChar === '"') {
      index++;
      newChar = '\\' + nextChar;
      actions[APPEND]();
      return true;
    }
  }

  while (mode != null) {
    index++;
    c = path[index];

    if (c === '\\' && maybeUnescapeQuote()) {
      continue;
    }

    type = getPathCharType(c);
    typeMap = pathStateMachine[mode];
    transition = typeMap[type] || typeMap['else'] || ERROR;

    if (transition === ERROR) {
      return; // parse error
    }

    mode = transition[0];
    action = actions[transition[1]];
    if (action) {
      newChar = transition[2];
      newChar = newChar === undefined ? c : newChar;
      if (action() === false) {
        return;
      }
    }

    if (mode === AFTER_PATH) {
      keys.raw = path;
      return keys;
    }
  }
}

/**
 * External parse that check for a cache hit first
 *
 * @param {String} path
 * @return {Array|undefined}
 */

function parsePath(path) {
  var hit = pathCache.get(path);
  if (!hit) {
    hit = parse(path);
    if (hit) {
      pathCache.put(path, hit);
    }
  }
  return hit;
}

/**
 * Get from an object from a path string
 *
 * @param {Object} obj
 * @param {String} path
 */

function getPath(obj, path) {
  return parseExpression(path).get(obj);
}

/**
 * Warn against setting non-existent root path on a vm.
 */

var warnNonExistent;
if (process.env.NODE_ENV !== 'production') {
  warnNonExistent = function (path) {
    warn('You are setting a non-existent path "' + path.raw + '" ' + 'on a vm instance. Consider pre-initializing the property ' + 'with the "data" option for more reliable reactivity ' + 'and better performance.');
  };
}

/**
 * Set on an object from a path
 *
 * @param {Object} obj
 * @param {String | Array} path
 * @param {*} val
 */

function setPath(obj, path, val) {
  var original = obj;
  if (typeof path === 'string') {
    path = parse(path);
  }
  if (!path || !isObject(obj)) {
    return false;
  }
  var last, key;
  for (var i = 0, l = path.length; i < l; i++) {
    last = obj;
    key = path[i];
    if (key.charAt(0) === '*') {
      key = parseExpression(key.slice(1)).get.call(original, original);
    }
    if (i < l - 1) {
      obj = obj[key];
      if (!isObject(obj)) {
        obj = {};
        if (process.env.NODE_ENV !== 'production' && last._isVue) {
          warnNonExistent(path);
        }
        set(last, key, obj);
      }
    } else {
      if (isArray(obj)) {
        obj.$set(key, val);
      } else if (key in obj) {
        obj[key] = val;
      } else {
        if (process.env.NODE_ENV !== 'production' && obj._isVue) {
          warnNonExistent(path);
        }
        set(obj, key, val);
      }
    }
  }
  return true;
}

var path = Object.freeze({
  parsePath: parsePath,
  getPath: getPath,
  setPath: setPath
});

var expressionCache = new Cache(1000);

var allowedKeywords = 'Math,Date,this,true,false,null,undefined,Infinity,NaN,' + 'isNaN,isFinite,decodeURI,decodeURIComponent,encodeURI,' + 'encodeURIComponent,parseInt,parseFloat';
var allowedKeywordsRE = new RegExp('^(' + allowedKeywords.replace(/,/g, '\\b|') + '\\b)');

// keywords that don't make sense inside expressions
var improperKeywords = 'break,case,class,catch,const,continue,debugger,default,' + 'delete,do,else,export,extends,finally,for,function,if,' + 'import,in,instanceof,let,return,super,switch,throw,try,' + 'var,while,with,yield,enum,await,implements,package,' + 'proctected,static,interface,private,public';
var improperKeywordsRE = new RegExp('^(' + improperKeywords.replace(/,/g, '\\b|') + '\\b)');

var wsRE = /\s/g;
var newlineRE = /\n/g;
var saveRE = /[\{,]\s*[\w\$_]+\s*:|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|new |typeof |void /g;
var restoreRE = /"(\d+)"/g;
var pathTestRE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\['.*?'\]|\[".*?"\]|\[\d+\]|\[[A-Za-z_$][\w$]*\])*$/;
var identRE = /[^\w$\.](?:[A-Za-z_$][\w$]*)/g;
var booleanLiteralRE = /^(?:true|false)$/;

/**
 * Save / Rewrite / Restore
 *
 * When rewriting paths found in an expression, it is
 * possible for the same letter sequences to be found in
 * strings and Object literal property keys. Therefore we
 * remove and store these parts in a temporary array, and
 * restore them after the path rewrite.
 */

var saved = [];

/**
 * Save replacer
 *
 * The save regex can match two possible cases:
 * 1. An opening object literal
 * 2. A string
 * If matched as a plain string, we need to escape its
 * newlines, since the string needs to be preserved when
 * generating the function body.
 *
 * @param {String} str
 * @param {String} isString - str if matched as a string
 * @return {String} - placeholder with index
 */

function save(str, isString) {
  var i = saved.length;
  saved[i] = isString ? str.replace(newlineRE, '\\n') : str;
  return '"' + i + '"';
}

/**
 * Path rewrite replacer
 *
 * @param {String} raw
 * @return {String}
 */

function rewrite(raw) {
  var c = raw.charAt(0);
  var path = raw.slice(1);
  if (allowedKeywordsRE.test(path)) {
    return raw;
  } else {
    path = path.indexOf('"') > -1 ? path.replace(restoreRE, restore) : path;
    return c + 'scope.' + path;
  }
}

/**
 * Restore replacer
 *
 * @param {String} str
 * @param {String} i - matched save index
 * @return {String}
 */

function restore(str, i) {
  return saved[i];
}

/**
 * Rewrite an expression, prefixing all path accessors with
 * `scope.` and generate getter/setter functions.
 *
 * @param {String} exp
 * @return {Function}
 */

function compileGetter(exp) {
  if (improperKeywordsRE.test(exp)) {
    process.env.NODE_ENV !== 'production' && warn('Avoid using reserved keywords in expression: ' + exp);
  }
  // reset state
  saved.length = 0;
  // save strings and object literal keys
  var body = exp.replace(saveRE, save).replace(wsRE, '');
  // rewrite all paths
  // pad 1 space here becaue the regex matches 1 extra char
  body = (' ' + body).replace(identRE, rewrite).replace(restoreRE, restore);
  return makeGetterFn(body);
}

/**
 * Build a getter function. Requires eval.
 *
 * We isolate the try/catch so it doesn't affect the
 * optimization of the parse function when it is not called.
 *
 * @param {String} body
 * @return {Function|undefined}
 */

function makeGetterFn(body) {
  try {
    return new Function('scope', 'return ' + body + ';');
  } catch (e) {
    process.env.NODE_ENV !== 'production' && warn('Invalid expression. ' + 'Generated function body: ' + body);
  }
}

/**
 * Compile a setter function for the expression.
 *
 * @param {String} exp
 * @return {Function|undefined}
 */

function compileSetter(exp) {
  var path = parsePath(exp);
  if (path) {
    return function (scope, val) {
      setPath(scope, path, val);
    };
  } else {
    process.env.NODE_ENV !== 'production' && warn('Invalid setter expression: ' + exp);
  }
}

/**
 * Parse an expression into re-written getter/setters.
 *
 * @param {String} exp
 * @param {Boolean} needSet
 * @return {Function}
 */

function parseExpression(exp, needSet) {
  exp = exp.trim();
  // try cache
  var hit = expressionCache.get(exp);
  if (hit) {
    if (needSet && !hit.set) {
      hit.set = compileSetter(hit.exp);
    }
    return hit;
  }
  var res = { exp: exp };
  res.get = isSimplePath(exp) && exp.indexOf('[') < 0
  // optimized super simple getter
  ? makeGetterFn('scope.' + exp)
  // dynamic getter
  : compileGetter(exp);
  if (needSet) {
    res.set = compileSetter(exp);
  }
  expressionCache.put(exp, res);
  return res;
}

/**
 * Check if an expression is a simple path.
 *
 * @param {String} exp
 * @return {Boolean}
 */

function isSimplePath(exp) {
  return pathTestRE.test(exp) &&
  // don't treat true/false as paths
  !booleanLiteralRE.test(exp) &&
  // Math constants e.g. Math.PI, Math.E etc.
  exp.slice(0, 5) !== 'Math.';
}

var expression = Object.freeze({
  parseExpression: parseExpression,
  isSimplePath: isSimplePath
});

// we have two separate queues: one for directive updates
// and one for user watcher registered via $watch().
// we want to guarantee directive updates to be called
// before user watchers so that when user watchers are
// triggered, the DOM would have already been in updated
// state.
var queue = [];
var userQueue = [];
var has = {};
var circular = {};
var waiting = false;
var internalQueueDepleted = false;

/**
 * Reset the batcher's state.
 */

function resetBatcherState() {
  queue = [];
  userQueue = [];
  has = {};
  circular = {};
  waiting = internalQueueDepleted = false;
}

/**
 * Flush both queues and run the watchers.
 */

function flushBatcherQueue() {
  runBatcherQueue(queue);
  internalQueueDepleted = true;
  runBatcherQueue(userQueue);
  // dev tool hook
  /* istanbul ignore if */
  if (process.env.NODE_ENV !== 'production') {
    if (inBrowser && window.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
      window.__VUE_DEVTOOLS_GLOBAL_HOOK__.emit('flush');
    }
  }
  resetBatcherState();
}

/**
 * Run the watchers in a single queue.
 *
 * @param {Array} queue
 */

function runBatcherQueue(queue) {
  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  for (var i = 0; i < queue.length; i++) {
    var watcher = queue[i];
    var id = watcher.id;
    has[id] = null;
    watcher.run();
    // in dev build, check and stop circular updates.
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1;
      if (circular[id] > config._maxUpdateCount) {
        queue.splice(has[id], 1);
        warn('You may have an infinite update loop for watcher ' + 'with expression: ' + watcher.expression);
      }
    }
  }
}

/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 *
 * @param {Watcher} watcher
 *   properties:
 *   - {Number} id
 *   - {Function} run
 */

function pushWatcher(watcher) {
  var id = watcher.id;
  if (has[id] == null) {
    // if an internal watcher is pushed, but the internal
    // queue is already depleted, we run it immediately.
    if (internalQueueDepleted && !watcher.user) {
      watcher.run();
      return;
    }
    // push watcher into appropriate queue
    var q = watcher.user ? userQueue : queue;
    has[id] = q.length;
    q.push(watcher);
    // queue the flush
    if (!waiting) {
      waiting = true;
      nextTick(flushBatcherQueue);
    }
  }
}

var uid$2 = 0;

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 *
 * @param {Vue} vm
 * @param {String} expression
 * @param {Function} cb
 * @param {Object} options
 *                 - {Array} filters
 *                 - {Boolean} twoWay
 *                 - {Boolean} deep
 *                 - {Boolean} user
 *                 - {Boolean} sync
 *                 - {Boolean} lazy
 *                 - {Function} [preProcess]
 *                 - {Function} [postProcess]
 * @constructor
 */
function Watcher(vm, expOrFn, cb, options) {
  // mix in options
  if (options) {
    extend(this, options);
  }
  var isFn = typeof expOrFn === 'function';
  this.vm = vm;
  vm._watchers.push(this);
  this.expression = isFn ? expOrFn.toString() : expOrFn;
  this.cb = cb;
  this.id = ++uid$2; // uid for batching
  this.active = true;
  this.dirty = this.lazy; // for lazy watchers
  this.deps = Object.create(null);
  this.newDeps = null;
  this.prevError = null; // for async error stacks
  // parse expression for getter/setter
  if (isFn) {
    this.getter = expOrFn;
    this.setter = undefined;
  } else {
    var res = parseExpression(expOrFn, this.twoWay);
    this.getter = res.get;
    this.setter = res.set;
  }
  this.value = this.lazy ? undefined : this.get();
  // state for avoiding false triggers for deep and Array
  // watchers during vm._digest()
  this.queued = this.shallow = false;
}

/**
 * Add a dependency to this directive.
 *
 * @param {Dep} dep
 */

Watcher.prototype.addDep = function (dep) {
  var id = dep.id;
  if (!this.newDeps[id]) {
    this.newDeps[id] = dep;
    if (!this.deps[id]) {
      this.deps[id] = dep;
      dep.addSub(this);
    }
  }
};

/**
 * Evaluate the getter, and re-collect dependencies.
 */

Watcher.prototype.get = function () {
  this.beforeGet();
  var scope = this.scope || this.vm;
  var value;
  try {
    value = this.getter.call(scope, scope);
  } catch (e) {
    if (process.env.NODE_ENV !== 'production' && config.warnExpressionErrors) {
      warn('Error when evaluating expression "' + this.expression + '". ' + (config.debug ? '' : 'Turn on debug mode to see stack trace.'), e);
    }
  }
  // "touch" every property so they are all tracked as
  // dependencies for deep watching
  if (this.deep) {
    traverse(value);
  }
  if (this.preProcess) {
    value = this.preProcess(value);
  }
  if (this.filters) {
    value = scope._applyFilters(value, null, this.filters, false);
  }
  if (this.postProcess) {
    value = this.postProcess(value);
  }
  this.afterGet();
  return value;
};

/**
 * Set the corresponding value with the setter.
 *
 * @param {*} value
 */

Watcher.prototype.set = function (value) {
  var scope = this.scope || this.vm;
  if (this.filters) {
    value = scope._applyFilters(value, this.value, this.filters, true);
  }
  try {
    this.setter.call(scope, scope, value);
  } catch (e) {
    if (process.env.NODE_ENV !== 'production' && config.warnExpressionErrors) {
      warn('Error when evaluating setter "' + this.expression + '"', e);
    }
  }
  // two-way sync for v-for alias
  var forContext = scope.$forContext;
  if (forContext && forContext.alias === this.expression) {
    if (forContext.filters) {
      process.env.NODE_ENV !== 'production' && warn('It seems you are using two-way binding on ' + 'a v-for alias (' + this.expression + '), and the ' + 'v-for has filters. This will not work properly. ' + 'Either remove the filters or use an array of ' + 'objects and bind to object properties instead.');
      return;
    }
    forContext._withLock(function () {
      if (scope.$key) {
        // original is an object
        forContext.rawValue[scope.$key] = value;
      } else {
        forContext.rawValue.$set(scope.$index, value);
      }
    });
  }
};

/**
 * Prepare for dependency collection.
 */

Watcher.prototype.beforeGet = function () {
  Dep.target = this;
  this.newDeps = Object.create(null);
};

/**
 * Clean up for dependency collection.
 */

Watcher.prototype.afterGet = function () {
  Dep.target = null;
  var ids = Object.keys(this.deps);
  var i = ids.length;
  while (i--) {
    var id = ids[i];
    if (!this.newDeps[id]) {
      this.deps[id].removeSub(this);
    }
  }
  this.deps = this.newDeps;
};

/**
 * Subscriber interface.
 * Will be called when a dependency changes.
 *
 * @param {Boolean} shallow
 */

Watcher.prototype.update = function (shallow) {
  if (this.lazy) {
    this.dirty = true;
  } else if (this.sync || !config.async) {
    this.run();
  } else {
    // if queued, only overwrite shallow with non-shallow,
    // but not the other way around.
    this.shallow = this.queued ? shallow ? this.shallow : false : !!shallow;
    this.queued = true;
    // record before-push error stack in debug mode
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.debug) {
      this.prevError = new Error('[vue] async stack trace');
    }
    pushWatcher(this);
  }
};

/**
 * Batcher job interface.
 * Will be called by the batcher.
 */

Watcher.prototype.run = function () {
  if (this.active) {
    var value = this.get();
    if (value !== this.value ||
    // Deep watchers and watchers on Object/Arrays should fire even
    // when the value is the same, because the value may
    // have mutated; but only do so if this is a
    // non-shallow update (caused by a vm digest).
    (isObject(value) || this.deep) && !this.shallow) {
      // set new value
      var oldValue = this.value;
      this.value = value;
      // in debug + async mode, when a watcher callbacks
      // throws, we also throw the saved before-push error
      // so the full cross-tick stack trace is available.
      var prevError = this.prevError;
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.debug && prevError) {
        this.prevError = null;
        try {
          this.cb.call(this.vm, value, oldValue);
        } catch (e) {
          nextTick(function () {
            throw prevError;
          }, 0);
          throw e;
        }
      } else {
        this.cb.call(this.vm, value, oldValue);
      }
    }
    this.queued = this.shallow = false;
  }
};

/**
 * Evaluate the value of the watcher.
 * This only gets called for lazy watchers.
 */

Watcher.prototype.evaluate = function () {
  // avoid overwriting another watcher that is being
  // collected.
  var current = Dep.target;
  this.value = this.get();
  this.dirty = false;
  Dep.target = current;
};

/**
 * Depend on all deps collected by this watcher.
 */

Watcher.prototype.depend = function () {
  var depIds = Object.keys(this.deps);
  var i = depIds.length;
  while (i--) {
    this.deps[depIds[i]].depend();
  }
};

/**
 * Remove self from all dependencies' subcriber list.
 */

Watcher.prototype.teardown = function () {
  if (this.active) {
    // remove self from vm's watcher list
    // we can skip this if the vm if being destroyed
    // which can improve teardown performance.
    if (!this.vm._isBeingDestroyed) {
      this.vm._watchers.$remove(this);
    }
    var depIds = Object.keys(this.deps);
    var i = depIds.length;
    while (i--) {
      this.deps[depIds[i]].removeSub(this);
    }
    this.active = false;
    this.vm = this.cb = this.value = null;
  }
};

/**
 * Recrusively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 *
 * @param {*} val
 */

function traverse(val) {
  var i, keys;
  if (isArray(val)) {
    i = val.length;
    while (i--) traverse(val[i]);
  } else if (isObject(val)) {
    keys = Object.keys(val);
    i = keys.length;
    while (i--) traverse(val[keys[i]]);
  }
}

var cloak = {
  bind: function bind() {
    var el = this.el;
    this.vm.$once('pre-hook:compiled', function () {
      el.removeAttribute('v-cloak');
    });
  }
};

var ref = {
  bind: function bind() {
    process.env.NODE_ENV !== 'production' && warn('v-ref:' + this.arg + ' must be used on a child ' + 'component. Found on <' + this.el.tagName.toLowerCase() + '>.');
  }
};

var ON = 700;
var MODEL = 800;
var BIND = 850;
var TRANSITION = 1100;
var EL = 1500;
var COMPONENT = 1500;
var PARTIAL = 1750;
var SLOT = 1750;
var FOR = 2000;
var IF = 2000;

var el = {

  priority: EL,

  bind: function bind() {
    /* istanbul ignore if */
    if (!this.arg) {
      return;
    }
    var id = this.id = camelize(this.arg);
    var refs = (this._scope || this.vm).$els;
    if (hasOwn(refs, id)) {
      refs[id] = this.el;
    } else {
      defineReactive(refs, id, this.el);
    }
  },

  unbind: function unbind() {
    var refs = (this._scope || this.vm).$els;
    if (refs[this.id] === this.el) {
      refs[this.id] = null;
    }
  }
};

var prefixes = ['-webkit-', '-moz-', '-ms-'];
var camelPrefixes = ['Webkit', 'Moz', 'ms'];
var importantRE = /!important;?$/;
var propCache = Object.create(null);

var testEl = null;

var style = {

  deep: true,

  update: function update(value) {
    if (typeof value === 'string') {
      this.el.style.cssText = value;
    } else if (isArray(value)) {
      this.handleObject(value.reduce(extend, {}));
    } else {
      this.handleObject(value || {});
    }
  },

  handleObject: function handleObject(value) {
    // cache object styles so that only changed props
    // are actually updated.
    var cache = this.cache || (this.cache = {});
    var name, val;
    for (name in cache) {
      if (!(name in value)) {
        this.handleSingle(name, null);
        delete cache[name];
      }
    }
    for (name in value) {
      val = value[name];
      if (val !== cache[name]) {
        cache[name] = val;
        this.handleSingle(name, val);
      }
    }
  },

  handleSingle: function handleSingle(prop, value) {
    prop = normalize(prop);
    if (!prop) return; // unsupported prop
    // cast possible numbers/booleans into strings
    if (value != null) value += '';
    if (value) {
      var isImportant = importantRE.test(value) ? 'important' : '';
      if (isImportant) {
        value = value.replace(importantRE, '').trim();
      }
      this.el.style.setProperty(prop, value, isImportant);
    } else {
      this.el.style.removeProperty(prop);
    }
  }

};

/**
 * Normalize a CSS property name.
 * - cache result
 * - auto prefix
 * - camelCase -> dash-case
 *
 * @param {String} prop
 * @return {String}
 */

function normalize(prop) {
  if (propCache[prop]) {
    return propCache[prop];
  }
  var res = prefix(prop);
  propCache[prop] = propCache[res] = res;
  return res;
}

/**
 * Auto detect the appropriate prefix for a CSS property.
 * https://gist.github.com/paulirish/523692
 *
 * @param {String} prop
 * @return {String}
 */

function prefix(prop) {
  prop = hyphenate(prop);
  var camel = camelize(prop);
  var upper = camel.charAt(0).toUpperCase() + camel.slice(1);
  if (!testEl) {
    testEl = document.createElement('div');
  }
  if (camel in testEl.style) {
    return prop;
  }
  var i = prefixes.length;
  var prefixed;
  while (i--) {
    prefixed = camelPrefixes[i] + upper;
    if (prefixed in testEl.style) {
      return prefixes[i] + prop;
    }
  }
}

// xlink
var xlinkNS = 'http://www.w3.org/1999/xlink';
var xlinkRE = /^xlink:/;

// check for attributes that prohibit interpolations
var disallowedInterpAttrRE = /^v-|^:|^@|^(is|transition|transition-mode|debounce|track-by|stagger|enter-stagger|leave-stagger)$/;

// these attributes should also set their corresponding properties
// because they only affect the initial state of the element
var attrWithPropsRE = /^(value|checked|selected|muted)$/;

// these attributes should set a hidden property for
// binding v-model to object values
var modelProps = {
  value: '_value',
  'true-value': '_trueValue',
  'false-value': '_falseValue'
};

var bind = {

  priority: BIND,

  bind: function bind() {
    var attr = this.arg;
    var tag = this.el.tagName;
    // should be deep watch on object mode
    if (!attr) {
      this.deep = true;
    }
    // handle interpolation bindings
    if (this.descriptor.interp) {
      // only allow binding on native attributes
      if (disallowedInterpAttrRE.test(attr) || attr === 'name' && (tag === 'PARTIAL' || tag === 'SLOT')) {
        process.env.NODE_ENV !== 'production' && warn(attr + '="' + this.descriptor.raw + '": ' + 'attribute interpolation is not allowed in Vue.js ' + 'directives and special attributes.');
        this.el.removeAttribute(attr);
        this.invalid = true;
      }

      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production') {
        var raw = attr + '="' + this.descriptor.raw + '": ';
        // warn src
        if (attr === 'src') {
          warn(raw + 'interpolation in "src" attribute will cause ' + 'a 404 request. Use v-bind:src instead.');
        }

        // warn style
        if (attr === 'style') {
          warn(raw + 'interpolation in "style" attribute will cause ' + 'the attribute to be discarded in Internet Explorer. ' + 'Use v-bind:style instead.');
        }
      }
    }
  },

  update: function update(value) {
    if (this.invalid) {
      return;
    }
    var attr = this.arg;
    if (this.arg) {
      this.handleSingle(attr, value);
    } else {
      this.handleObject(value || {});
    }
  },

  // share object handler with v-bind:class
  handleObject: style.handleObject,

  handleSingle: function handleSingle(attr, value) {
    var el = this.el;
    var interp = this.descriptor.interp;
    if (!interp && attrWithPropsRE.test(attr) && attr in el) {
      el[attr] = attr === 'value' ? value == null // IE9 will set input.value to "null" for null...
      ? '' : value : value;
    }
    // set model props
    var modelProp = modelProps[attr];
    if (!interp && modelProp) {
      el[modelProp] = value;
      // update v-model if present
      var model = el.__v_model;
      if (model) {
        model.listener();
      }
    }
    // do not set value attribute for textarea
    if (attr === 'value' && el.tagName === 'TEXTAREA') {
      el.removeAttribute(attr);
      return;
    }
    // update attribute
    if (value != null && value !== false) {
      if (attr === 'class') {
        // handle edge case #1960:
        // class interpolation should not overwrite Vue transition class
        if (el.__v_trans) {
          value += ' ' + el.__v_trans.id + '-transition';
        }
        setClass(el, value);
      } else if (xlinkRE.test(attr)) {
        el.setAttributeNS(xlinkNS, attr, value);
      } else {
        el.setAttribute(attr, value);
      }
    } else {
      el.removeAttribute(attr);
    }
  }
};

// keyCode aliases
var keyCodes = {
  esc: 27,
  tab: 9,
  enter: 13,
  space: 32,
  'delete': 46,
  up: 38,
  left: 37,
  right: 39,
  down: 40
};

function keyFilter(handler, keys) {
  var codes = keys.map(function (key) {
    var charCode = key.charCodeAt(0);
    if (charCode > 47 && charCode < 58) {
      return parseInt(key, 10);
    }
    if (key.length === 1) {
      charCode = key.toUpperCase().charCodeAt(0);
      if (charCode > 64 && charCode < 91) {
        return charCode;
      }
    }
    return keyCodes[key];
  });
  return function keyHandler(e) {
    if (codes.indexOf(e.keyCode) > -1) {
      return handler.call(this, e);
    }
  };
}

function stopFilter(handler) {
  return function stopHandler(e) {
    e.stopPropagation();
    return handler.call(this, e);
  };
}

function preventFilter(handler) {
  return function preventHandler(e) {
    e.preventDefault();
    return handler.call(this, e);
  };
}

var on = {

  acceptStatement: true,
  priority: ON,

  bind: function bind() {
    // deal with iframes
    if (this.el.tagName === 'IFRAME' && this.arg !== 'load') {
      var self = this;
      this.iframeBind = function () {
        on$1(self.el.contentWindow, self.arg, self.handler);
      };
      this.on('load', this.iframeBind);
    }
  },

  update: function update(handler) {
    // stub a noop for v-on with no value,
    // e.g. @mousedown.prevent
    if (!this.descriptor.raw) {
      handler = function () {};
    }

    if (typeof handler !== 'function') {
      process.env.NODE_ENV !== 'production' && warn('v-on:' + this.arg + '="' + this.expression + '" expects a function value, ' + 'got ' + handler);
      return;
    }

    // apply modifiers
    if (this.modifiers.stop) {
      handler = stopFilter(handler);
    }
    if (this.modifiers.prevent) {
      handler = preventFilter(handler);
    }
    // key filter
    var keys = Object.keys(this.modifiers).filter(function (key) {
      return key !== 'stop' && key !== 'prevent';
    });
    if (keys.length) {
      handler = keyFilter(handler, keys);
    }

    this.reset();
    this.handler = handler;

    if (this.iframeBind) {
      this.iframeBind();
    } else {
      on$1(this.el, this.arg, this.handler);
    }
  },

  reset: function reset() {
    var el = this.iframeBind ? this.el.contentWindow : this.el;
    if (this.handler) {
      off(el, this.arg, this.handler);
    }
  },

  unbind: function unbind() {
    this.reset();
  }
};

var checkbox = {

  bind: function bind() {
    var self = this;
    var el = this.el;

    this.getValue = function () {
      return el.hasOwnProperty('_value') ? el._value : self.params.number ? toNumber(el.value) : el.value;
    };

    function getBooleanValue() {
      var val = el.checked;
      if (val && el.hasOwnProperty('_trueValue')) {
        return el._trueValue;
      }
      if (!val && el.hasOwnProperty('_falseValue')) {
        return el._falseValue;
      }
      return val;
    }

    this.listener = function () {
      var model = self._watcher.value;
      if (isArray(model)) {
        var val = self.getValue();
        if (el.checked) {
          if (indexOf(model, val) < 0) {
            model.push(val);
          }
        } else {
          model.$remove(val);
        }
      } else {
        self.set(getBooleanValue());
      }
    };

    this.on('change', this.listener);
    if (el.hasAttribute('checked')) {
      this.afterBind = this.listener;
    }
  },

  update: function update(value) {
    var el = this.el;
    if (isArray(value)) {
      el.checked = indexOf(value, this.getValue()) > -1;
    } else {
      if (el.hasOwnProperty('_trueValue')) {
        el.checked = looseEqual(value, el._trueValue);
      } else {
        el.checked = !!value;
      }
    }
  }
};

var select = {

  bind: function bind() {
    var self = this;
    var el = this.el;

    // method to force update DOM using latest value.
    this.forceUpdate = function () {
      if (self._watcher) {
        self.update(self._watcher.get());
      }
    };

    // check if this is a multiple select
    var multiple = this.multiple = el.hasAttribute('multiple');

    // attach listener
    this.listener = function () {
      var value = getValue(el, multiple);
      value = self.params.number ? isArray(value) ? value.map(toNumber) : toNumber(value) : value;
      self.set(value);
    };
    this.on('change', this.listener);

    // if has initial value, set afterBind
    var initValue = getValue(el, multiple, true);
    if (multiple && initValue.length || !multiple && initValue !== null) {
      this.afterBind = this.listener;
    }

    // All major browsers except Firefox resets
    // selectedIndex with value -1 to 0 when the element
    // is appended to a new parent, therefore we have to
    // force a DOM update whenever that happens...
    this.vm.$on('hook:attached', this.forceUpdate);
  },

  update: function update(value) {
    var el = this.el;
    el.selectedIndex = -1;
    var multi = this.multiple && isArray(value);
    var options = el.options;
    var i = options.length;
    var op, val;
    while (i--) {
      op = options[i];
      val = op.hasOwnProperty('_value') ? op._value : op.value;
      /* eslint-disable eqeqeq */
      op.selected = multi ? indexOf$1(value, val) > -1 : looseEqual(value, val);
      /* eslint-enable eqeqeq */
    }
  },

  unbind: function unbind() {
    /* istanbul ignore next */
    this.vm.$off('hook:attached', this.forceUpdate);
  }
};

/**
 * Get select value
 *
 * @param {SelectElement} el
 * @param {Boolean} multi
 * @param {Boolean} init
 * @return {Array|*}
 */

function getValue(el, multi, init) {
  var res = multi ? [] : null;
  var op, val, selected;
  for (var i = 0, l = el.options.length; i < l; i++) {
    op = el.options[i];
    selected = init ? op.hasAttribute('selected') : op.selected;
    if (selected) {
      val = op.hasOwnProperty('_value') ? op._value : op.value;
      if (multi) {
        res.push(val);
      } else {
        return val;
      }
    }
  }
  return res;
}

/**
 * Native Array.indexOf uses strict equal, but in this
 * case we need to match string/numbers with custom equal.
 *
 * @param {Array} arr
 * @param {*} val
 */

function indexOf$1(arr, val) {
  var i = arr.length;
  while (i--) {
    if (looseEqual(arr[i], val)) {
      return i;
    }
  }
  return -1;
}

var radio = {

  bind: function bind() {
    var self = this;
    var el = this.el;

    this.getValue = function () {
      // value overwrite via v-bind:value
      if (el.hasOwnProperty('_value')) {
        return el._value;
      }
      var val = el.value;
      if (self.params.number) {
        val = toNumber(val);
      }
      return val;
    };

    this.listener = function () {
      self.set(self.getValue());
    };
    this.on('change', this.listener);

    if (el.hasAttribute('checked')) {
      this.afterBind = this.listener;
    }
  },

  update: function update(value) {
    this.el.checked = looseEqual(value, this.getValue());
  }
};

var text$2 = {

  bind: function bind() {
    var self = this;
    var el = this.el;
    var isRange = el.type === 'range';
    var lazy = this.params.lazy;
    var number = this.params.number;
    var debounce = this.params.debounce;

    // handle composition events.
    //   http://blog.evanyou.me/2014/01/03/composition-event/
    // skip this for Android because it handles composition
    // events quite differently. Android doesn't trigger
    // composition events for language input methods e.g.
    // Chinese, but instead triggers them for spelling
    // suggestions... (see Discussion/#162)
    var composing = false;
    if (!isAndroid && !isRange) {
      this.on('compositionstart', function () {
        composing = true;
      });
      this.on('compositionend', function () {
        composing = false;
        // in IE11 the "compositionend" event fires AFTER
        // the "input" event, so the input handler is blocked
        // at the end... have to call it here.
        //
        // #1327: in lazy mode this is unecessary.
        if (!lazy) {
          self.listener();
        }
      });
    }

    // prevent messing with the input when user is typing,
    // and force update on blur.
    this.focused = false;
    if (!isRange) {
      this.on('focus', function () {
        self.focused = true;
      });
      this.on('blur', function () {
        self.focused = false;
        // do not sync value after fragment removal (#2017)
        if (!self._frag || self._frag.inserted) {
          self.rawListener();
        }
      });
    }

    // Now attach the main listener
    this.listener = this.rawListener = function () {
      if (composing || !self._bound) {
        return;
      }
      var val = number || isRange ? toNumber(el.value) : el.value;
      self.set(val);
      // force update on next tick to avoid lock & same value
      // also only update when user is not typing
      nextTick(function () {
        if (self._bound && !self.focused) {
          self.update(self._watcher.value);
        }
      });
    };

    // apply debounce
    if (debounce) {
      this.listener = _debounce(this.listener, debounce);
    }

    // Support jQuery events, since jQuery.trigger() doesn't
    // trigger native events in some cases and some plugins
    // rely on $.trigger()
    //
    // We want to make sure if a listener is attached using
    // jQuery, it is also removed with jQuery, that's why
    // we do the check for each directive instance and
    // store that check result on itself. This also allows
    // easier test coverage control by unsetting the global
    // jQuery variable in tests.
    this.hasjQuery = typeof jQuery === 'function';
    if (this.hasjQuery) {
      jQuery(el).on('change', this.listener);
      if (!lazy) {
        jQuery(el).on('input', this.listener);
      }
    } else {
      this.on('change', this.listener);
      if (!lazy) {
        this.on('input', this.listener);
      }
    }

    // IE9 doesn't fire input event on backspace/del/cut
    if (!lazy && isIE9) {
      this.on('cut', function () {
        nextTick(self.listener);
      });
      this.on('keyup', function (e) {
        if (e.keyCode === 46 || e.keyCode === 8) {
          self.listener();
        }
      });
    }

    // set initial value if present
    if (el.hasAttribute('value') || el.tagName === 'TEXTAREA' && el.value.trim()) {
      this.afterBind = this.listener;
    }
  },

  update: function update(value) {
    this.el.value = _toString(value);
  },

  unbind: function unbind() {
    var el = this.el;
    if (this.hasjQuery) {
      jQuery(el).off('change', this.listener);
      jQuery(el).off('input', this.listener);
    }
  }
};

var handlers = {
  text: text$2,
  radio: radio,
  select: select,
  checkbox: checkbox
};

var model = {

  priority: MODEL,
  twoWay: true,
  handlers: handlers,
  params: ['lazy', 'number', 'debounce'],

  /**
   * Possible elements:
   *   <select>
   *   <textarea>
   *   <input type="*">
   *     - text
   *     - checkbox
   *     - radio
   *     - number
   */

  bind: function bind() {
    // friendly warning...
    this.checkFilters();
    if (this.hasRead && !this.hasWrite) {
      process.env.NODE_ENV !== 'production' && warn('It seems you are using a read-only filter with ' + 'v-model. You might want to use a two-way filter ' + 'to ensure correct behavior.');
    }
    var el = this.el;
    var tag = el.tagName;
    var handler;
    if (tag === 'INPUT') {
      handler = handlers[el.type] || handlers.text;
    } else if (tag === 'SELECT') {
      handler = handlers.select;
    } else if (tag === 'TEXTAREA') {
      handler = handlers.text;
    } else {
      process.env.NODE_ENV !== 'production' && warn('v-model does not support element type: ' + tag);
      return;
    }
    el.__v_model = this;
    handler.bind.call(this);
    this.update = handler.update;
    this._unbind = handler.unbind;
  },

  /**
   * Check read/write filter stats.
   */

  checkFilters: function checkFilters() {
    var filters = this.filters;
    if (!filters) return;
    var i = filters.length;
    while (i--) {
      var filter = resolveAsset(this.vm.$options, 'filters', filters[i].name);
      if (typeof filter === 'function' || filter.read) {
        this.hasRead = true;
      }
      if (filter.write) {
        this.hasWrite = true;
      }
    }
  },

  unbind: function unbind() {
    this.el.__v_model = null;
    this._unbind && this._unbind();
  }
};

var show = {

  bind: function bind() {
    // check else block
    var next = this.el.nextElementSibling;
    if (next && getAttr(next, 'v-else') !== null) {
      this.elseEl = next;
    }
  },

  update: function update(value) {
    this.apply(this.el, value);
    if (this.elseEl) {
      this.apply(this.elseEl, !value);
    }
  },

  apply: function apply(el, value) {
    if (inDoc(el)) {
      applyTransition(el, value ? 1 : -1, toggle, this.vm);
    } else {
      toggle();
    }
    function toggle() {
      el.style.display = value ? '' : 'none';
    }
  }
};

var templateCache = new Cache(1000);
var idSelectorCache = new Cache(1000);

var map = {
  efault: [0, '', ''],
  legend: [1, '<fieldset>', '</fieldset>'],
  tr: [2, '<table><tbody>', '</tbody></table>'],
  col: [2, '<table><tbody></tbody><colgroup>', '</colgroup></table>']
};

map.td = map.th = [3, '<table><tbody><tr>', '</tr></tbody></table>'];

map.option = map.optgroup = [1, '<select multiple="multiple">', '</select>'];

map.thead = map.tbody = map.colgroup = map.caption = map.tfoot = [1, '<table>', '</table>'];

map.g = map.defs = map.symbol = map.use = map.image = map.text = map.circle = map.ellipse = map.line = map.path = map.polygon = map.polyline = map.rect = [1, '<svg ' + 'xmlns="http://www.w3.org/2000/svg" ' + 'xmlns:xlink="http://www.w3.org/1999/xlink" ' + 'xmlns:ev="http://www.w3.org/2001/xml-events"' + 'version="1.1">', '</svg>'];

/**
 * Check if a node is a supported template node with a
 * DocumentFragment content.
 *
 * @param {Node} node
 * @return {Boolean}
 */

function isRealTemplate(node) {
  return isTemplate(node) && node.content instanceof DocumentFragment;
}

var tagRE$1 = /<([\w:]+)/;
var entityRE = /&#?\w+?;/;

/**
 * Convert a string template to a DocumentFragment.
 * Determines correct wrapping by tag types. Wrapping
 * strategy found in jQuery & component/domify.
 *
 * @param {String} templateString
 * @param {Boolean} raw
 * @return {DocumentFragment}
 */

function stringToFragment(templateString, raw) {
  // try a cache hit first
  var hit = templateCache.get(templateString);
  if (hit) {
    return hit;
  }

  var frag = document.createDocumentFragment();
  var tagMatch = templateString.match(tagRE$1);
  var entityMatch = entityRE.test(templateString);

  if (!tagMatch && !entityMatch) {
    // text only, return a single text node.
    frag.appendChild(document.createTextNode(templateString));
  } else {

    var tag = tagMatch && tagMatch[1];
    var wrap = map[tag] || map.efault;
    var depth = wrap[0];
    var prefix = wrap[1];
    var suffix = wrap[2];
    var node = document.createElement('div');

    if (!raw) {
      templateString = templateString.trim();
    }
    node.innerHTML = prefix + templateString + suffix;
    while (depth--) {
      node = node.lastChild;
    }

    var child;
    /* eslint-disable no-cond-assign */
    while (child = node.firstChild) {
      /* eslint-enable no-cond-assign */
      frag.appendChild(child);
    }
  }

  templateCache.put(templateString, frag);
  return frag;
}

/**
 * Convert a template node to a DocumentFragment.
 *
 * @param {Node} node
 * @return {DocumentFragment}
 */

function nodeToFragment(node) {
  // if its a template tag and the browser supports it,
  // its content is already a document fragment.
  if (isRealTemplate(node)) {
    trimNode(node.content);
    return node.content;
  }
  // script template
  if (node.tagName === 'SCRIPT') {
    return stringToFragment(node.textContent);
  }
  // normal node, clone it to avoid mutating the original
  var clonedNode = cloneNode(node);
  var frag = document.createDocumentFragment();
  var child;
  /* eslint-disable no-cond-assign */
  while (child = clonedNode.firstChild) {
    /* eslint-enable no-cond-assign */
    frag.appendChild(child);
  }
  trimNode(frag);
  return frag;
}

// Test for the presence of the Safari template cloning bug
// https://bugs.webkit.org/showug.cgi?id=137755
var hasBrokenTemplate = (function () {
  /* istanbul ignore else */
  if (inBrowser) {
    var a = document.createElement('div');
    a.innerHTML = '<template>1</template>';
    return !a.cloneNode(true).firstChild.innerHTML;
  } else {
    return false;
  }
})();

// Test for IE10/11 textarea placeholder clone bug
var hasTextareaCloneBug = (function () {
  /* istanbul ignore else */
  if (inBrowser) {
    var t = document.createElement('textarea');
    t.placeholder = 't';
    return t.cloneNode(true).value === 't';
  } else {
    return false;
  }
})();

/**
 * 1. Deal with Safari cloning nested <template> bug by
 *    manually cloning all template instances.
 * 2. Deal with IE10/11 textarea placeholder bug by setting
 *    the correct value after cloning.
 *
 * @param {Element|DocumentFragment} node
 * @return {Element|DocumentFragment}
 */

function cloneNode(node) {
  if (!node.querySelectorAll) {
    return node.cloneNode();
  }
  var res = node.cloneNode(true);
  var i, original, cloned;
  /* istanbul ignore if */
  if (hasBrokenTemplate) {
    var tempClone = res;
    if (isRealTemplate(node)) {
      node = node.content;
      tempClone = res.content;
    }
    original = node.querySelectorAll('template');
    if (original.length) {
      cloned = tempClone.querySelectorAll('template');
      i = cloned.length;
      while (i--) {
        cloned[i].parentNode.replaceChild(cloneNode(original[i]), cloned[i]);
      }
    }
  }
  /* istanbul ignore if */
  if (hasTextareaCloneBug) {
    if (node.tagName === 'TEXTAREA') {
      res.value = node.value;
    } else {
      original = node.querySelectorAll('textarea');
      if (original.length) {
        cloned = res.querySelectorAll('textarea');
        i = cloned.length;
        while (i--) {
          cloned[i].value = original[i].value;
        }
      }
    }
  }
  return res;
}

/**
 * Process the template option and normalizes it into a
 * a DocumentFragment that can be used as a partial or a
 * instance template.
 *
 * @param {*} template
 *        Possible values include:
 *        - DocumentFragment object
 *        - Node object of type Template
 *        - id selector: '#some-template-id'
 *        - template string: '<div><span>{{msg}}</span></div>'
 * @param {Boolean} shouldClone
 * @param {Boolean} raw
 *        inline HTML interpolation. Do not check for id
 *        selector and keep whitespace in the string.
 * @return {DocumentFragment|undefined}
 */

function parseTemplate(template, shouldClone, raw) {
  var node, frag;

  // if the template is already a document fragment,
  // do nothing
  if (template instanceof DocumentFragment) {
    trimNode(template);
    return shouldClone ? cloneNode(template) : template;
  }

  if (typeof template === 'string') {
    // id selector
    if (!raw && template.charAt(0) === '#') {
      // id selector can be cached too
      frag = idSelectorCache.get(template);
      if (!frag) {
        node = document.getElementById(template.slice(1));
        if (node) {
          frag = nodeToFragment(node);
          // save selector to cache
          idSelectorCache.put(template, frag);
        }
      }
    } else {
      // normal string template
      frag = stringToFragment(template, raw);
    }
  } else if (template.nodeType) {
    // a direct node
    frag = nodeToFragment(template);
  }

  return frag && shouldClone ? cloneNode(frag) : frag;
}

var template = Object.freeze({
  cloneNode: cloneNode,
  parseTemplate: parseTemplate
});

/**
 * Abstraction for a partially-compiled fragment.
 * Can optionally compile content with a child scope.
 *
 * @param {Function} linker
 * @param {Vue} vm
 * @param {DocumentFragment} frag
 * @param {Vue} [host]
 * @param {Object} [scope]
 */
function Fragment(linker, vm, frag, host, scope, parentFrag) {
  this.children = [];
  this.childFrags = [];
  this.vm = vm;
  this.scope = scope;
  this.inserted = false;
  this.parentFrag = parentFrag;
  if (parentFrag) {
    parentFrag.childFrags.push(this);
  }
  this.unlink = linker(vm, frag, host, scope, this);
  var single = this.single = frag.childNodes.length === 1 &&
  // do not go single mode if the only node is an anchor
  !frag.childNodes[0].__vue_anchor;
  if (single) {
    this.node = frag.childNodes[0];
    this.before = singleBefore;
    this.remove = singleRemove;
  } else {
    this.node = createAnchor('fragment-start');
    this.end = createAnchor('fragment-end');
    this.frag = frag;
    prepend(this.node, frag);
    frag.appendChild(this.end);
    this.before = multiBefore;
    this.remove = multiRemove;
  }
  this.node.__vfrag__ = this;
}

/**
 * Call attach/detach for all components contained within
 * this fragment. Also do so recursively for all child
 * fragments.
 *
 * @param {Function} hook
 */

Fragment.prototype.callHook = function (hook) {
  var i, l;
  for (i = 0, l = this.children.length; i < l; i++) {
    hook(this.children[i]);
  }
  for (i = 0, l = this.childFrags.length; i < l; i++) {
    this.childFrags[i].callHook(hook);
  }
};

/**
 * Destroy the fragment.
 */

Fragment.prototype.destroy = function () {
  if (this.parentFrag) {
    this.parentFrag.childFrags.$remove(this);
  }
  this.unlink();
};

/**
 * Insert fragment before target, single node version
 *
 * @param {Node} target
 * @param {Boolean} withTransition
 */

function singleBefore(target, withTransition) {
  this.inserted = true;
  var method = withTransition !== false ? beforeWithTransition : before;
  method(this.node, target, this.vm);
  if (inDoc(this.node)) {
    this.callHook(attach);
  }
}

/**
 * Remove fragment, single node version
 */

function singleRemove() {
  this.inserted = false;
  var shouldCallRemove = inDoc(this.node);
  var self = this;
  self.callHook(destroyChild);
  removeWithTransition(this.node, this.vm, function () {
    if (shouldCallRemove) {
      self.callHook(detach);
    }
    self.destroy();
  });
}

/**
 * Insert fragment before target, multi-nodes version
 *
 * @param {Node} target
 * @param {Boolean} withTransition
 */

function multiBefore(target, withTransition) {
  this.inserted = true;
  var vm = this.vm;
  var method = withTransition !== false ? beforeWithTransition : before;
  mapNodeRange(this.node, this.end, function (node) {
    method(node, target, vm);
  });
  if (inDoc(this.node)) {
    this.callHook(attach);
  }
}

/**
 * Remove fragment, multi-nodes version
 */

function multiRemove() {
  this.inserted = false;
  var self = this;
  var shouldCallRemove = inDoc(this.node);
  self.callHook(destroyChild);
  removeNodeRange(this.node, this.end, this.vm, this.frag, function () {
    if (shouldCallRemove) {
      self.callHook(detach);
    }
    self.destroy();
  });
}

/**
 * Call attach hook for a Vue instance.
 *
 * @param {Vue} child
 */

function attach(child) {
  if (!child._isAttached) {
    child._callHook('attached');
  }
}

/**
 * Call destroy for all contained instances,
 * with remove:false and defer:true.
 * Defer is necessary because we need to
 * keep the children to call detach hooks
 * on them.
 *
 * @param {Vue} child
 */

function destroyChild(child) {
  child.$destroy(false, true);
}

/**
 * Call detach hook for a Vue instance.
 *
 * @param {Vue} child
 */

function detach(child) {
  if (child._isAttached) {
    child._callHook('detached');
  }
}

var linkerCache = new Cache(5000);

/**
 * A factory that can be used to create instances of a
 * fragment. Caches the compiled linker if possible.
 *
 * @param {Vue} vm
 * @param {Element|String} el
 */
function FragmentFactory(vm, el) {
  this.vm = vm;
  var template;
  var isString = typeof el === 'string';
  if (isString || isTemplate(el)) {
    template = parseTemplate(el, true);
  } else {
    template = document.createDocumentFragment();
    template.appendChild(el);
  }
  this.template = template;
  // linker can be cached, but only for components
  var linker;
  var cid = vm.constructor.cid;
  if (cid > 0) {
    var cacheId = cid + (isString ? el : el.outerHTML);
    linker = linkerCache.get(cacheId);
    if (!linker) {
      linker = compile(template, vm.$options, true);
      linkerCache.put(cacheId, linker);
    }
  } else {
    linker = compile(template, vm.$options, true);
  }
  this.linker = linker;
}

/**
 * Create a fragment instance with given host and scope.
 *
 * @param {Vue} host
 * @param {Object} scope
 * @param {Fragment} parentFrag
 */

FragmentFactory.prototype.create = function (host, scope, parentFrag) {
  var frag = cloneNode(this.template);
  return new Fragment(this.linker, this.vm, frag, host, scope, parentFrag);
};

var vIf = {

  priority: IF,

  bind: function bind() {
    var el = this.el;
    if (!el.__vue__) {
      // check else block
      var next = el.nextElementSibling;
      if (next && getAttr(next, 'v-else') !== null) {
        remove(next);
        this.elseFactory = new FragmentFactory(this.vm, next);
      }
      // check main block
      this.anchor = createAnchor('v-if');
      replace(el, this.anchor);
      this.factory = new FragmentFactory(this.vm, el);
    } else {
      process.env.NODE_ENV !== 'production' && warn('v-if="' + this.expression + '" cannot be ' + 'used on an instance root element.');
      this.invalid = true;
    }
  },

  update: function update(value) {
    if (this.invalid) return;
    if (value) {
      if (!this.frag) {
        this.insert();
      }
    } else {
      this.remove();
    }
  },

  insert: function insert() {
    if (this.elseFrag) {
      this.elseFrag.remove();
      this.elseFrag = null;
    }
    this.frag = this.factory.create(this._host, this._scope, this._frag);
    this.frag.before(this.anchor);
  },

  remove: function remove() {
    if (this.frag) {
      this.frag.remove();
      this.frag = null;
    }
    if (this.elseFactory && !this.elseFrag) {
      this.elseFrag = this.elseFactory.create(this._host, this._scope, this._frag);
      this.elseFrag.before(this.anchor);
    }
  },

  unbind: function unbind() {
    if (this.frag) {
      this.frag.destroy();
    }
  }
};

var uid$1 = 0;

var vFor = {

  priority: FOR,

  params: ['track-by', 'stagger', 'enter-stagger', 'leave-stagger'],

  bind: function bind() {
    // support "item in items" syntax
    var inMatch = this.expression.match(/(.*) in (.*)/);
    if (inMatch) {
      var itMatch = inMatch[1].match(/\((.*),(.*)\)/);
      if (itMatch) {
        this.iterator = itMatch[1].trim();
        this.alias = itMatch[2].trim();
      } else {
        this.alias = inMatch[1].trim();
      }
      this.expression = inMatch[2];
    }

    if (!this.alias) {
      process.env.NODE_ENV !== 'production' && warn('Alias is required in v-for.');
      return;
    }

    // uid as a cache identifier
    this.id = '__v-for__' + ++uid$1;

    // check if this is an option list,
    // so that we know if we need to update the <select>'s
    // v-model when the option list has changed.
    // because v-model has a lower priority than v-for,
    // the v-model is not bound here yet, so we have to
    // retrive it in the actual updateModel() function.
    var tag = this.el.tagName;
    this.isOption = (tag === 'OPTION' || tag === 'OPTGROUP') && this.el.parentNode.tagName === 'SELECT';

    // setup anchor nodes
    this.start = createAnchor('v-for-start');
    this.end = createAnchor('v-for-end');
    replace(this.el, this.end);
    before(this.start, this.end);

    // cache
    this.cache = Object.create(null);

    // fragment factory
    this.factory = new FragmentFactory(this.vm, this.el);
  },

  update: function update(data) {
    this.diff(data);
    this.updateRef();
    this.updateModel();
  },

  /**
   * Diff, based on new data and old data, determine the
   * minimum amount of DOM manipulations needed to make the
   * DOM reflect the new data Array.
   *
   * The algorithm diffs the new data Array by storing a
   * hidden reference to an owner vm instance on previously
   * seen data. This allows us to achieve O(n) which is
   * better than a levenshtein distance based algorithm,
   * which is O(m * n).
   *
   * @param {Array} data
   */

  diff: function diff(data) {
    // check if the Array was converted from an Object
    var item = data[0];
    var convertedFromObject = this.fromObject = isObject(item) && hasOwn(item, '$key') && hasOwn(item, '$value');

    var trackByKey = this.params.trackBy;
    var oldFrags = this.frags;
    var frags = this.frags = new Array(data.length);
    var alias = this.alias;
    var iterator = this.iterator;
    var start = this.start;
    var end = this.end;
    var inDocument = inDoc(start);
    var init = !oldFrags;
    var i, l, frag, key, value, primitive;

    // First pass, go through the new Array and fill up
    // the new frags array. If a piece of data has a cached
    // instance for it, we reuse it. Otherwise build a new
    // instance.
    for (i = 0, l = data.length; i < l; i++) {
      item = data[i];
      key = convertedFromObject ? item.$key : null;
      value = convertedFromObject ? item.$value : item;
      primitive = !isObject(value);
      frag = !init && this.getCachedFrag(value, i, key);
      if (frag) {
        // reusable fragment
        frag.reused = true;
        // update $index
        frag.scope.$index = i;
        // update $key
        if (key) {
          frag.scope.$key = key;
        }
        // update iterator
        if (iterator) {
          frag.scope[iterator] = key !== null ? key : i;
        }
        // update data for track-by, object repeat &
        // primitive values.
        if (trackByKey || convertedFromObject || primitive) {
          frag.scope[alias] = value;
        }
      } else {
        // new isntance
        frag = this.create(value, alias, i, key);
        frag.fresh = !init;
      }
      frags[i] = frag;
      if (init) {
        frag.before(end);
      }
    }

    // we're done for the initial render.
    if (init) {
      return;
    }

    // Second pass, go through the old fragments and
    // destroy those who are not reused (and remove them
    // from cache)
    var removalIndex = 0;
    var totalRemoved = oldFrags.length - frags.length;
    for (i = 0, l = oldFrags.length; i < l; i++) {
      frag = oldFrags[i];
      if (!frag.reused) {
        this.deleteCachedFrag(frag);
        this.remove(frag, removalIndex++, totalRemoved, inDocument);
      }
    }

    // Final pass, move/insert new fragments into the
    // right place.
    var targetPrev, prevEl, currentPrev;
    var insertionIndex = 0;
    for (i = 0, l = frags.length; i < l; i++) {
      frag = frags[i];
      // this is the frag that we should be after
      targetPrev = frags[i - 1];
      prevEl = targetPrev ? targetPrev.staggerCb ? targetPrev.staggerAnchor : targetPrev.end || targetPrev.node : start;
      if (frag.reused && !frag.staggerCb) {
        currentPrev = findPrevFrag(frag, start, this.id);
        if (currentPrev !== targetPrev && (!currentPrev ||
        // optimization for moving a single item.
        // thanks to suggestions by @livoras in #1807
        findPrevFrag(currentPrev, start, this.id) !== targetPrev)) {
          this.move(frag, prevEl);
        }
      } else {
        // new instance, or still in stagger.
        // insert with updated stagger index.
        this.insert(frag, insertionIndex++, prevEl, inDocument);
      }
      frag.reused = frag.fresh = false;
    }
  },

  /**
   * Create a new fragment instance.
   *
   * @param {*} value
   * @param {String} alias
   * @param {Number} index
   * @param {String} [key]
   * @return {Fragment}
   */

  create: function create(value, alias, index, key) {
    var host = this._host;
    // create iteration scope
    var parentScope = this._scope || this.vm;
    var scope = Object.create(parentScope);
    // ref holder for the scope
    scope.$refs = Object.create(parentScope.$refs);
    scope.$els = Object.create(parentScope.$els);
    // make sure point $parent to parent scope
    scope.$parent = parentScope;
    // for two-way binding on alias
    scope.$forContext = this;
    // define scope properties
    defineReactive(scope, alias, value);
    defineReactive(scope, '$index', index);
    if (key) {
      defineReactive(scope, '$key', key);
    } else if (scope.$key) {
      // avoid accidental fallback
      def(scope, '$key', null);
    }
    if (this.iterator) {
      defineReactive(scope, this.iterator, key !== null ? key : index);
    }
    var frag = this.factory.create(host, scope, this._frag);
    frag.forId = this.id;
    this.cacheFrag(value, frag, index, key);
    return frag;
  },

  /**
   * Update the v-ref on owner vm.
   */

  updateRef: function updateRef() {
    var ref = this.descriptor.ref;
    if (!ref) return;
    var hash = (this._scope || this.vm).$refs;
    var refs;
    if (!this.fromObject) {
      refs = this.frags.map(findVmFromFrag);
    } else {
      refs = {};
      this.frags.forEach(function (frag) {
        refs[frag.scope.$key] = findVmFromFrag(frag);
      });
    }
    hash[ref] = refs;
  },

  /**
   * For option lists, update the containing v-model on
   * parent <select>.
   */

  updateModel: function updateModel() {
    if (this.isOption) {
      var parent = this.start.parentNode;
      var model = parent && parent.__v_model;
      if (model) {
        model.forceUpdate();
      }
    }
  },

  /**
   * Insert a fragment. Handles staggering.
   *
   * @param {Fragment} frag
   * @param {Number} index
   * @param {Node} prevEl
   * @param {Boolean} inDocument
   */

  insert: function insert(frag, index, prevEl, inDocument) {
    if (frag.staggerCb) {
      frag.staggerCb.cancel();
      frag.staggerCb = null;
    }
    var staggerAmount = this.getStagger(frag, index, null, 'enter');
    if (inDocument && staggerAmount) {
      // create an anchor and insert it synchronously,
      // so that we can resolve the correct order without
      // worrying about some elements not inserted yet
      var anchor = frag.staggerAnchor;
      if (!anchor) {
        anchor = frag.staggerAnchor = createAnchor('stagger-anchor');
        anchor.__vfrag__ = frag;
      }
      after(anchor, prevEl);
      var op = frag.staggerCb = cancellable(function () {
        frag.staggerCb = null;
        frag.before(anchor);
        remove(anchor);
      });
      setTimeout(op, staggerAmount);
    } else {
      frag.before(prevEl.nextSibling);
    }
  },

  /**
   * Remove a fragment. Handles staggering.
   *
   * @param {Fragment} frag
   * @param {Number} index
   * @param {Number} total
   * @param {Boolean} inDocument
   */

  remove: function remove(frag, index, total, inDocument) {
    if (frag.staggerCb) {
      frag.staggerCb.cancel();
      frag.staggerCb = null;
      // it's not possible for the same frag to be removed
      // twice, so if we have a pending stagger callback,
      // it means this frag is queued for enter but removed
      // before its transition started. Since it is already
      // destroyed, we can just leave it in detached state.
      return;
    }
    var staggerAmount = this.getStagger(frag, index, total, 'leave');
    if (inDocument && staggerAmount) {
      var op = frag.staggerCb = cancellable(function () {
        frag.staggerCb = null;
        frag.remove();
      });
      setTimeout(op, staggerAmount);
    } else {
      frag.remove();
    }
  },

  /**
   * Move a fragment to a new position.
   * Force no transition.
   *
   * @param {Fragment} frag
   * @param {Node} prevEl
   */

  move: function move(frag, prevEl) {
    frag.before(prevEl.nextSibling, false);
  },

  /**
   * Cache a fragment using track-by or the object key.
   *
   * @param {*} value
   * @param {Fragment} frag
   * @param {Number} index
   * @param {String} [key]
   */

  cacheFrag: function cacheFrag(value, frag, index, key) {
    var trackByKey = this.params.trackBy;
    var cache = this.cache;
    var primitive = !isObject(value);
    var id;
    if (key || trackByKey || primitive) {
      id = trackByKey ? trackByKey === '$index' ? index : value[trackByKey] : key || value;
      if (!cache[id]) {
        cache[id] = frag;
      } else if (trackByKey !== '$index') {
        process.env.NODE_ENV !== 'production' && this.warnDuplicate(value);
      }
    } else {
      id = this.id;
      if (hasOwn(value, id)) {
        if (value[id] === null) {
          value[id] = frag;
        } else {
          process.env.NODE_ENV !== 'production' && this.warnDuplicate(value);
        }
      } else {
        def(value, id, frag);
      }
    }
    frag.raw = value;
  },

  /**
   * Get a cached fragment from the value/index/key
   *
   * @param {*} value
   * @param {Number} index
   * @param {String} key
   * @return {Fragment}
   */

  getCachedFrag: function getCachedFrag(value, index, key) {
    var trackByKey = this.params.trackBy;
    var primitive = !isObject(value);
    var frag;
    if (key || trackByKey || primitive) {
      var id = trackByKey ? trackByKey === '$index' ? index : value[trackByKey] : key || value;
      frag = this.cache[id];
    } else {
      frag = value[this.id];
    }
    if (frag && (frag.reused || frag.fresh)) {
      process.env.NODE_ENV !== 'production' && this.warnDuplicate(value);
    }
    return frag;
  },

  /**
   * Delete a fragment from cache.
   *
   * @param {Fragment} frag
   */

  deleteCachedFrag: function deleteCachedFrag(frag) {
    var value = frag.raw;
    var trackByKey = this.params.trackBy;
    var scope = frag.scope;
    var index = scope.$index;
    // fix #948: avoid accidentally fall through to
    // a parent repeater which happens to have $key.
    var key = hasOwn(scope, '$key') && scope.$key;
    var primitive = !isObject(value);
    if (trackByKey || key || primitive) {
      var id = trackByKey ? trackByKey === '$index' ? index : value[trackByKey] : key || value;
      this.cache[id] = null;
    } else {
      value[this.id] = null;
      frag.raw = null;
    }
  },

  /**
   * Get the stagger amount for an insertion/removal.
   *
   * @param {Fragment} frag
   * @param {Number} index
   * @param {Number} total
   * @param {String} type
   */

  getStagger: function getStagger(frag, index, total, type) {
    type = type + 'Stagger';
    var trans = frag.node.__v_trans;
    var hooks = trans && trans.hooks;
    var hook = hooks && (hooks[type] || hooks.stagger);
    return hook ? hook.call(frag, index, total) : index * parseInt(this.params[type] || this.params.stagger, 10);
  },

  /**
   * Pre-process the value before piping it through the
   * filters. This is passed to and called by the watcher.
   */

  _preProcess: function _preProcess(value) {
    // regardless of type, store the un-filtered raw value.
    this.rawValue = value;
    return value;
  },

  /**
   * Post-process the value after it has been piped through
   * the filters. This is passed to and called by the watcher.
   *
   * It is necessary for this to be called during the
   * wathcer's dependency collection phase because we want
   * the v-for to update when the source Object is mutated.
   */

  _postProcess: function _postProcess(value) {
    if (isArray(value)) {
      return value;
    } else if (isPlainObject(value)) {
      // convert plain object to array.
      var keys = Object.keys(value);
      var i = keys.length;
      var res = new Array(i);
      var key;
      while (i--) {
        key = keys[i];
        res[i] = {
          $key: key,
          $value: value[key]
        };
      }
      return res;
    } else {
      if (typeof value === 'number') {
        value = range(value);
      }
      return value || [];
    }
  },

  unbind: function unbind() {
    if (this.descriptor.ref) {
      (this._scope || this.vm).$refs[this.descriptor.ref] = null;
    }
    if (this.frags) {
      var i = this.frags.length;
      var frag;
      while (i--) {
        frag = this.frags[i];
        this.deleteCachedFrag(frag);
        frag.destroy();
      }
    }
  }
};

/**
 * Helper to find the previous element that is a fragment
 * anchor. This is necessary because a destroyed frag's
 * element could still be lingering in the DOM before its
 * leaving transition finishes, but its inserted flag
 * should have been set to false so we can skip them.
 *
 * If this is a block repeat, we want to make sure we only
 * return frag that is bound to this v-for. (see #929)
 *
 * @param {Fragment} frag
 * @param {Comment|Text} anchor
 * @param {String} id
 * @return {Fragment}
 */

function findPrevFrag(frag, anchor, id) {
  var el = frag.node.previousSibling;
  /* istanbul ignore if */
  if (!el) return;
  frag = el.__vfrag__;
  while ((!frag || frag.forId !== id || !frag.inserted) && el !== anchor) {
    el = el.previousSibling;
    /* istanbul ignore if */
    if (!el) return;
    frag = el.__vfrag__;
  }
  return frag;
}

/**
 * Find a vm from a fragment.
 *
 * @param {Fragment} frag
 * @return {Vue|undefined}
 */

function findVmFromFrag(frag) {
  var node = frag.node;
  // handle multi-node frag
  if (frag.end) {
    while (!node.__vue__ && node !== frag.end && node.nextSibling) {
      node = node.nextSibling;
    }
  }
  return node.__vue__;
}

/**
 * Create a range array from given number.
 *
 * @param {Number} n
 * @return {Array}
 */

function range(n) {
  var i = -1;
  var ret = new Array(n);
  while (++i < n) {
    ret[i] = i;
  }
  return ret;
}

if (process.env.NODE_ENV !== 'production') {
  vFor.warnDuplicate = function (value) {
    warn('Duplicate value found in v-for="' + this.descriptor.raw + '": ' + JSON.stringify(value) + '. Use track-by="$index" if ' + 'you are expecting duplicate values.');
  };
}

var html = {

  bind: function bind() {
    // a comment node means this is a binding for
    // {{{ inline unescaped html }}}
    if (this.el.nodeType === 8) {
      // hold nodes
      this.nodes = [];
      // replace the placeholder with proper anchor
      this.anchor = createAnchor('v-html');
      replace(this.el, this.anchor);
    }
  },

  update: function update(value) {
    value = _toString(value);
    if (this.nodes) {
      this.swap(value);
    } else {
      this.el.innerHTML = value;
    }
  },

  swap: function swap(value) {
    // remove old nodes
    var i = this.nodes.length;
    while (i--) {
      remove(this.nodes[i]);
    }
    // convert new value to a fragment
    // do not attempt to retrieve from id selector
    var frag = parseTemplate(value, true, true);
    // save a reference to these nodes so we can remove later
    this.nodes = toArray(frag.childNodes);
    before(frag, this.anchor);
  }
};

var text = {

  bind: function bind() {
    this.attr = this.el.nodeType === 3 ? 'data' : 'textContent';
  },

  update: function update(value) {
    this.el[this.attr] = _toString(value);
  }
};

// must export plain object
var publicDirectives = {
  text: text,
  html: html,
  'for': vFor,
  'if': vIf,
  show: show,
  model: model,
  on: on,
  bind: bind,
  el: el,
  ref: ref,
  cloak: cloak
};

var queue$1 = [];
var queued = false;

/**
 * Push a job into the queue.
 *
 * @param {Function} job
 */

function pushJob(job) {
  queue$1.push(job);
  if (!queued) {
    queued = true;
    nextTick(flush);
  }
}

/**
 * Flush the queue, and do one forced reflow before
 * triggering transitions.
 */

function flush() {
  // Force layout
  var f = document.documentElement.offsetHeight;
  for (var i = 0; i < queue$1.length; i++) {
    queue$1[i]();
  }
  queue$1 = [];
  queued = false;
  // dummy return, so js linters don't complain about
  // unused variable f
  return f;
}

var TYPE_TRANSITION = 1;
var TYPE_ANIMATION = 2;
var transDurationProp = transitionProp + 'Duration';
var animDurationProp = animationProp + 'Duration';

/**
 * A Transition object that encapsulates the state and logic
 * of the transition.
 *
 * @param {Element} el
 * @param {String} id
 * @param {Object} hooks
 * @param {Vue} vm
 */
function Transition(el, id, hooks, vm) {
  this.id = id;
  this.el = el;
  this.enterClass = id + '-enter';
  this.leaveClass = id + '-leave';
  this.hooks = hooks;
  this.vm = vm;
  // async state
  this.pendingCssEvent = this.pendingCssCb = this.cancel = this.pendingJsCb = this.op = this.cb = null;
  this.justEntered = false;
  this.entered = this.left = false;
  this.typeCache = {};
  // bind
  var self = this;['enterNextTick', 'enterDone', 'leaveNextTick', 'leaveDone'].forEach(function (m) {
    self[m] = bind$1(self[m], self);
  });
}

var p$1 = Transition.prototype;

/**
 * Start an entering transition.
 *
 * 1. enter transition triggered
 * 2. call beforeEnter hook
 * 3. add enter class
 * 4. insert/show element
 * 5. call enter hook (with possible explicit js callback)
 * 6. reflow
 * 7. based on transition type:
 *    - transition:
 *        remove class now, wait for transitionend,
 *        then done if there's no explicit js callback.
 *    - animation:
 *        wait for animationend, remove class,
 *        then done if there's no explicit js callback.
 *    - no css transition:
 *        done now if there's no explicit js callback.
 * 8. wait for either done or js callback, then call
 *    afterEnter hook.
 *
 * @param {Function} op - insert/show the element
 * @param {Function} [cb]
 */

p$1.enter = function (op, cb) {
  this.cancelPending();
  this.callHook('beforeEnter');
  this.cb = cb;
  addClass(this.el, this.enterClass);
  op();
  this.entered = false;
  this.callHookWithCb('enter');
  if (this.entered) {
    return; // user called done synchronously.
  }
  this.cancel = this.hooks && this.hooks.enterCancelled;
  pushJob(this.enterNextTick);
};

/**
 * The "nextTick" phase of an entering transition, which is
 * to be pushed into a queue and executed after a reflow so
 * that removing the class can trigger a CSS transition.
 */

p$1.enterNextTick = function () {

  // Important hack:
  // in Chrome, if a just-entered element is applied the
  // leave class while its interpolated property still has
  // a very small value (within one frame), Chrome will
  // skip the leave transition entirely and not firing the
  // transtionend event. Therefore we need to protected
  // against such cases using a one-frame timeout.
  this.justEntered = true;
  var self = this;
  setTimeout(function () {
    self.justEntered = false;
  }, 17);

  var enterDone = this.enterDone;
  var type = this.getCssTransitionType(this.enterClass);
  if (!this.pendingJsCb) {
    if (type === TYPE_TRANSITION) {
      // trigger transition by removing enter class now
      removeClass(this.el, this.enterClass);
      this.setupCssCb(transitionEndEvent, enterDone);
    } else if (type === TYPE_ANIMATION) {
      this.setupCssCb(animationEndEvent, enterDone);
    } else {
      enterDone();
    }
  } else if (type === TYPE_TRANSITION) {
    removeClass(this.el, this.enterClass);
  }
};

/**
 * The "cleanup" phase of an entering transition.
 */

p$1.enterDone = function () {
  this.entered = true;
  this.cancel = this.pendingJsCb = null;
  removeClass(this.el, this.enterClass);
  this.callHook('afterEnter');
  if (this.cb) this.cb();
};

/**
 * Start a leaving transition.
 *
 * 1. leave transition triggered.
 * 2. call beforeLeave hook
 * 3. add leave class (trigger css transition)
 * 4. call leave hook (with possible explicit js callback)
 * 5. reflow if no explicit js callback is provided
 * 6. based on transition type:
 *    - transition or animation:
 *        wait for end event, remove class, then done if
 *        there's no explicit js callback.
 *    - no css transition:
 *        done if there's no explicit js callback.
 * 7. wait for either done or js callback, then call
 *    afterLeave hook.
 *
 * @param {Function} op - remove/hide the element
 * @param {Function} [cb]
 */

p$1.leave = function (op, cb) {
  this.cancelPending();
  this.callHook('beforeLeave');
  this.op = op;
  this.cb = cb;
  addClass(this.el, this.leaveClass);
  this.left = false;
  this.callHookWithCb('leave');
  if (this.left) {
    return; // user called done synchronously.
  }
  this.cancel = this.hooks && this.hooks.leaveCancelled;
  // only need to handle leaveDone if
  // 1. the transition is already done (synchronously called
  //    by the user, which causes this.op set to null)
  // 2. there's no explicit js callback
  if (this.op && !this.pendingJsCb) {
    // if a CSS transition leaves immediately after enter,
    // the transitionend event never fires. therefore we
    // detect such cases and end the leave immediately.
    if (this.justEntered) {
      this.leaveDone();
    } else {
      pushJob(this.leaveNextTick);
    }
  }
};

/**
 * The "nextTick" phase of a leaving transition.
 */

p$1.leaveNextTick = function () {
  var type = this.getCssTransitionType(this.leaveClass);
  if (type) {
    var event = type === TYPE_TRANSITION ? transitionEndEvent : animationEndEvent;
    this.setupCssCb(event, this.leaveDone);
  } else {
    this.leaveDone();
  }
};

/**
 * The "cleanup" phase of a leaving transition.
 */

p$1.leaveDone = function () {
  this.left = true;
  this.cancel = this.pendingJsCb = null;
  this.op();
  removeClass(this.el, this.leaveClass);
  this.callHook('afterLeave');
  if (this.cb) this.cb();
  this.op = null;
};

/**
 * Cancel any pending callbacks from a previously running
 * but not finished transition.
 */

p$1.cancelPending = function () {
  this.op = this.cb = null;
  var hasPending = false;
  if (this.pendingCssCb) {
    hasPending = true;
    off(this.el, this.pendingCssEvent, this.pendingCssCb);
    this.pendingCssEvent = this.pendingCssCb = null;
  }
  if (this.pendingJsCb) {
    hasPending = true;
    this.pendingJsCb.cancel();
    this.pendingJsCb = null;
  }
  if (hasPending) {
    removeClass(this.el, this.enterClass);
    removeClass(this.el, this.leaveClass);
  }
  if (this.cancel) {
    this.cancel.call(this.vm, this.el);
    this.cancel = null;
  }
};

/**
 * Call a user-provided synchronous hook function.
 *
 * @param {String} type
 */

p$1.callHook = function (type) {
  if (this.hooks && this.hooks[type]) {
    this.hooks[type].call(this.vm, this.el);
  }
};

/**
 * Call a user-provided, potentially-async hook function.
 * We check for the length of arguments to see if the hook
 * expects a `done` callback. If true, the transition's end
 * will be determined by when the user calls that callback;
 * otherwise, the end is determined by the CSS transition or
 * animation.
 *
 * @param {String} type
 */

p$1.callHookWithCb = function (type) {
  var hook = this.hooks && this.hooks[type];
  if (hook) {
    if (hook.length > 1) {
      this.pendingJsCb = cancellable(this[type + 'Done']);
    }
    hook.call(this.vm, this.el, this.pendingJsCb);
  }
};

/**
 * Get an element's transition type based on the
 * calculated styles.
 *
 * @param {String} className
 * @return {Number}
 */

p$1.getCssTransitionType = function (className) {
  /* istanbul ignore if */
  if (!transitionEndEvent ||
  // skip CSS transitions if page is not visible -
  // this solves the issue of transitionend events not
  // firing until the page is visible again.
  // pageVisibility API is supported in IE10+, same as
  // CSS transitions.
  document.hidden ||
  // explicit js-only transition
  this.hooks && this.hooks.css === false ||
  // element is hidden
  isHidden(this.el)) {
    return;
  }
  var type = this.typeCache[className];
  if (type) return type;
  var inlineStyles = this.el.style;
  var computedStyles = window.getComputedStyle(this.el);
  var transDuration = inlineStyles[transDurationProp] || computedStyles[transDurationProp];
  if (transDuration && transDuration !== '0s') {
    type = TYPE_TRANSITION;
  } else {
    var animDuration = inlineStyles[animDurationProp] || computedStyles[animDurationProp];
    if (animDuration && animDuration !== '0s') {
      type = TYPE_ANIMATION;
    }
  }
  if (type) {
    this.typeCache[className] = type;
  }
  return type;
};

/**
 * Setup a CSS transitionend/animationend callback.
 *
 * @param {String} event
 * @param {Function} cb
 */

p$1.setupCssCb = function (event, cb) {
  this.pendingCssEvent = event;
  var self = this;
  var el = this.el;
  var onEnd = this.pendingCssCb = function (e) {
    if (e.target === el) {
      off(el, event, onEnd);
      self.pendingCssEvent = self.pendingCssCb = null;
      if (!self.pendingJsCb && cb) {
        cb();
      }
    }
  };
  on$1(el, event, onEnd);
};

/**
 * Check if an element is hidden - in that case we can just
 * skip the transition alltogether.
 *
 * @param {Element} el
 * @return {Boolean}
 */

function isHidden(el) {
  return !(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

var transition = {

  priority: TRANSITION,

  update: function update(id, oldId) {
    var el = this.el;
    // resolve on owner vm
    var hooks = resolveAsset(this.vm.$options, 'transitions', id);
    id = id || 'v';
    // apply on closest vm
    el.__v_trans = new Transition(el, id, hooks, this.el.__vue__ || this.vm);
    if (oldId) {
      removeClass(el, oldId + '-transition');
    }
    addClass(el, id + '-transition');
  }
};

var bindingModes = config._propBindingModes;

var propDef = {

  bind: function bind() {

    var child = this.vm;
    var parent = child._context;
    // passed in from compiler directly
    var prop = this.descriptor.prop;
    var childKey = prop.path;
    var parentKey = prop.parentPath;
    var twoWay = prop.mode === bindingModes.TWO_WAY;

    var parentWatcher = this.parentWatcher = new Watcher(parent, parentKey, function (val) {
      val = coerceProp(prop, val);
      if (assertProp(prop, val)) {
        child[childKey] = val;
      }
    }, {
      twoWay: twoWay,
      filters: prop.filters,
      // important: props need to be observed on the
      // v-for scope if present
      scope: this._scope
    });

    // set the child initial value.
    initProp(child, prop, parentWatcher.value);

    // setup two-way binding
    if (twoWay) {
      // important: defer the child watcher creation until
      // the created hook (after data observation)
      var self = this;
      child.$once('pre-hook:created', function () {
        self.childWatcher = new Watcher(child, childKey, function (val) {
          parentWatcher.set(val);
        }, {
          // ensure sync upward before parent sync down.
          // this is necessary in cases e.g. the child
          // mutates a prop array, then replaces it. (#1683)
          sync: true
        });
      });
    }
  },

  unbind: function unbind() {
    this.parentWatcher.teardown();
    if (this.childWatcher) {
      this.childWatcher.teardown();
    }
  }
};

var component = {

  priority: COMPONENT,

  params: ['keep-alive', 'transition-mode', 'inline-template'],

  /**
   * Setup. Two possible usages:
   *
   * - static:
   *   <comp> or <div v-component="comp">
   *
   * - dynamic:
   *   <component :is="view">
   */

  bind: function bind() {
    if (!this.el.__vue__) {
      // keep-alive cache
      this.keepAlive = this.params.keepAlive;
      if (this.keepAlive) {
        this.cache = {};
      }
      // check inline-template
      if (this.params.inlineTemplate) {
        // extract inline template as a DocumentFragment
        this.inlineTemplate = extractContent(this.el, true);
      }
      // component resolution related state
      this.pendingComponentCb = this.Component = null;
      // transition related state
      this.pendingRemovals = 0;
      this.pendingRemovalCb = null;
      // create a ref anchor
      this.anchor = createAnchor('v-component');
      replace(this.el, this.anchor);
      // remove is attribute.
      // this is removed during compilation, but because compilation is
      // cached, when the component is used elsewhere this attribute
      // will remain at link time.
      this.el.removeAttribute('is');
      // remove ref, same as above
      if (this.descriptor.ref) {
        this.el.removeAttribute('v-ref:' + hyphenate(this.descriptor.ref));
      }
      // if static, build right now.
      if (this.literal) {
        this.setComponent(this.expression);
      }
    } else {
      process.env.NODE_ENV !== 'production' && warn('cannot mount component "' + this.expression + '" ' + 'on already mounted element: ' + this.el);
    }
  },

  /**
   * Public update, called by the watcher in the dynamic
   * literal scenario, e.g. <component :is="view">
   */

  update: function update(value) {
    if (!this.literal) {
      this.setComponent(value);
    }
  },

  /**
   * Switch dynamic components. May resolve the component
   * asynchronously, and perform transition based on
   * specified transition mode. Accepts a few additional
   * arguments specifically for vue-router.
   *
   * The callback is called when the full transition is
   * finished.
   *
   * @param {String} value
   * @param {Function} [cb]
   */

  setComponent: function setComponent(value, cb) {
    this.invalidatePending();
    if (!value) {
      // just remove current
      this.unbuild(true);
      this.remove(this.childVM, cb);
      this.childVM = null;
    } else {
      var self = this;
      this.resolveComponent(value, function () {
        self.mountComponent(cb);
      });
    }
  },

  /**
   * Resolve the component constructor to use when creating
   * the child vm.
   */

  resolveComponent: function resolveComponent(id, cb) {
    var self = this;
    this.pendingComponentCb = cancellable(function (Component) {
      self.ComponentName = Component.options.name || id;
      self.Component = Component;
      cb();
    });
    this.vm._resolveComponent(id, this.pendingComponentCb);
  },

  /**
   * Create a new instance using the current constructor and
   * replace the existing instance. This method doesn't care
   * whether the new component and the old one are actually
   * the same.
   *
   * @param {Function} [cb]
   */

  mountComponent: function mountComponent(cb) {
    // actual mount
    this.unbuild(true);
    var self = this;
    var activateHook = this.Component.options.activate;
    var cached = this.getCached();
    var newComponent = this.build();
    if (activateHook && !cached) {
      this.waitingFor = newComponent;
      activateHook.call(newComponent, function () {
        if (self.waitingFor !== newComponent) {
          return;
        }
        self.waitingFor = null;
        self.transition(newComponent, cb);
      });
    } else {
      // update ref for kept-alive component
      if (cached) {
        newComponent._updateRef();
      }
      this.transition(newComponent, cb);
    }
  },

  /**
   * When the component changes or unbinds before an async
   * constructor is resolved, we need to invalidate its
   * pending callback.
   */

  invalidatePending: function invalidatePending() {
    if (this.pendingComponentCb) {
      this.pendingComponentCb.cancel();
      this.pendingComponentCb = null;
    }
  },

  /**
   * Instantiate/insert a new child vm.
   * If keep alive and has cached instance, insert that
   * instance; otherwise build a new one and cache it.
   *
   * @param {Object} [extraOptions]
   * @return {Vue} - the created instance
   */

  build: function build(extraOptions) {
    var cached = this.getCached();
    if (cached) {
      return cached;
    }
    if (this.Component) {
      // default options
      var options = {
        name: this.ComponentName,
        el: cloneNode(this.el),
        template: this.inlineTemplate,
        // make sure to add the child with correct parent
        // if this is a transcluded component, its parent
        // should be the transclusion host.
        parent: this._host || this.vm,
        // if no inline-template, then the compiled
        // linker can be cached for better performance.
        _linkerCachable: !this.inlineTemplate,
        _ref: this.descriptor.ref,
        _asComponent: true,
        _isRouterView: this._isRouterView,
        // if this is a transcluded component, context
        // will be the common parent vm of this instance
        // and its host.
        _context: this.vm,
        // if this is inside an inline v-for, the scope
        // will be the intermediate scope created for this
        // repeat fragment. this is used for linking props
        // and container directives.
        _scope: this._scope,
        // pass in the owner fragment of this component.
        // this is necessary so that the fragment can keep
        // track of its contained components in order to
        // call attach/detach hooks for them.
        _frag: this._frag
      };
      // extra options
      // in 1.0.0 this is used by vue-router only
      /* istanbul ignore if */
      if (extraOptions) {
        extend(options, extraOptions);
      }
      var child = new this.Component(options);
      if (this.keepAlive) {
        this.cache[this.Component.cid] = child;
      }
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && this.el.hasAttribute('transition') && child._isFragment) {
        warn('Transitions will not work on a fragment instance. ' + 'Template: ' + child.$options.template);
      }
      return child;
    }
  },

  /**
   * Try to get a cached instance of the current component.
   *
   * @return {Vue|undefined}
   */

  getCached: function getCached() {
    return this.keepAlive && this.cache[this.Component.cid];
  },

  /**
   * Teardown the current child, but defers cleanup so
   * that we can separate the destroy and removal steps.
   *
   * @param {Boolean} defer
   */

  unbuild: function unbuild(defer) {
    if (this.waitingFor) {
      this.waitingFor.$destroy();
      this.waitingFor = null;
    }
    var child = this.childVM;
    if (!child || this.keepAlive) {
      if (child) {
        // remove ref
        child._updateRef(true);
      }
      return;
    }
    // the sole purpose of `deferCleanup` is so that we can
    // "deactivate" the vm right now and perform DOM removal
    // later.
    child.$destroy(false, defer);
  },

  /**
   * Remove current destroyed child and manually do
   * the cleanup after removal.
   *
   * @param {Function} cb
   */

  remove: function remove(child, cb) {
    var keepAlive = this.keepAlive;
    if (child) {
      // we may have a component switch when a previous
      // component is still being transitioned out.
      // we want to trigger only one lastest insertion cb
      // when the existing transition finishes. (#1119)
      this.pendingRemovals++;
      this.pendingRemovalCb = cb;
      var self = this;
      child.$remove(function () {
        self.pendingRemovals--;
        if (!keepAlive) child._cleanup();
        if (!self.pendingRemovals && self.pendingRemovalCb) {
          self.pendingRemovalCb();
          self.pendingRemovalCb = null;
        }
      });
    } else if (cb) {
      cb();
    }
  },

  /**
   * Actually swap the components, depending on the
   * transition mode. Defaults to simultaneous.
   *
   * @param {Vue} target
   * @param {Function} [cb]
   */

  transition: function transition(target, cb) {
    var self = this;
    var current = this.childVM;
    // for devtool inspection
    if (process.env.NODE_ENV !== 'production') {
      if (current) current._inactive = true;
      target._inactive = false;
    }
    this.childVM = target;
    switch (self.params.transitionMode) {
      case 'in-out':
        target.$before(self.anchor, function () {
          self.remove(current, cb);
        });
        break;
      case 'out-in':
        self.remove(current, function () {
          target.$before(self.anchor, cb);
        });
        break;
      default:
        self.remove(current);
        target.$before(self.anchor, cb);
    }
  },

  /**
   * Unbind.
   */

  unbind: function unbind() {
    this.invalidatePending();
    // Do not defer cleanup when unbinding
    this.unbuild();
    // destroy all keep-alive cached instances
    if (this.cache) {
      for (var key in this.cache) {
        this.cache[key].$destroy();
      }
      this.cache = null;
    }
  }
};

var vClass = {

  deep: true,

  update: function update(value) {
    if (value && typeof value === 'string') {
      this.handleObject(stringToObject(value));
    } else if (isPlainObject(value)) {
      this.handleObject(value);
    } else if (isArray(value)) {
      this.handleArray(value);
    } else {
      this.cleanup();
    }
  },

  handleObject: function handleObject(value) {
    this.cleanup(value);
    var keys = this.prevKeys = Object.keys(value);
    for (var i = 0, l = keys.length; i < l; i++) {
      var key = keys[i];
      if (value[key]) {
        addClass(this.el, key);
      } else {
        removeClass(this.el, key);
      }
    }
  },

  handleArray: function handleArray(value) {
    this.cleanup(value);
    for (var i = 0, l = value.length; i < l; i++) {
      if (value[i]) {
        addClass(this.el, value[i]);
      }
    }
    this.prevKeys = value.slice();
  },

  cleanup: function cleanup(value) {
    if (this.prevKeys) {
      var i = this.prevKeys.length;
      while (i--) {
        var key = this.prevKeys[i];
        if (key && (!value || !contains$1(value, key))) {
          removeClass(this.el, key);
        }
      }
    }
  }
};

function stringToObject(value) {
  var res = {};
  var keys = value.trim().split(/\s+/);
  var i = keys.length;
  while (i--) {
    res[keys[i]] = true;
  }
  return res;
}

function contains$1(value, key) {
  return isArray(value) ? value.indexOf(key) > -1 : hasOwn(value, key);
}

var internalDirectives = {
  style: style,
  'class': vClass,
  component: component,
  prop: propDef,
  transition: transition
};

var propBindingModes = config._propBindingModes;
var empty = {};

// regexes
var identRE$1 = /^[$_a-zA-Z]+[\w$]*$/;
var settablePathRE = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*|\[[^\[\]]+\])*$/;

/**
 * Compile props on a root element and return
 * a props link function.
 *
 * @param {Element|DocumentFragment} el
 * @param {Array} propOptions
 * @return {Function} propsLinkFn
 */

function compileProps(el, propOptions) {
  var props = [];
  var names = Object.keys(propOptions);
  var i = names.length;
  var options, name, attr, value, path, parsed, prop;
  while (i--) {
    name = names[i];
    options = propOptions[name] || empty;

    if (process.env.NODE_ENV !== 'production' && name === '$data') {
      warn('Do not use $data as prop.');
      continue;
    }

    // props could contain dashes, which will be
    // interpreted as minus calculations by the parser
    // so we need to camelize the path here
    path = camelize(name);
    if (!identRE$1.test(path)) {
      process.env.NODE_ENV !== 'production' && warn('Invalid prop key: "' + name + '". Prop keys ' + 'must be valid identifiers.');
      continue;
    }

    prop = {
      name: name,
      path: path,
      options: options,
      mode: propBindingModes.ONE_WAY,
      raw: null
    };

    attr = hyphenate(name);
    // first check dynamic version
    if ((value = getBindAttr(el, attr)) === null) {
      if ((value = getBindAttr(el, attr + '.sync')) !== null) {
        prop.mode = propBindingModes.TWO_WAY;
      } else if ((value = getBindAttr(el, attr + '.once')) !== null) {
        prop.mode = propBindingModes.ONE_TIME;
      }
    }
    if (value !== null) {
      // has dynamic binding!
      prop.raw = value;
      parsed = parseDirective(value);
      value = parsed.expression;
      prop.filters = parsed.filters;
      // check binding type
      if (isLiteral(value)) {
        // for expressions containing literal numbers and
        // booleans, there's no need to setup a prop binding,
        // so we can optimize them as a one-time set.
        prop.optimizedLiteral = true;
      } else {
        prop.dynamic = true;
        // check non-settable path for two-way bindings
        if (process.env.NODE_ENV !== 'production' && prop.mode === propBindingModes.TWO_WAY && !settablePathRE.test(value)) {
          prop.mode = propBindingModes.ONE_WAY;
          warn('Cannot bind two-way prop with non-settable ' + 'parent path: ' + value);
        }
      }
      prop.parentPath = value;

      // warn required two-way
      if (process.env.NODE_ENV !== 'production' && options.twoWay && prop.mode !== propBindingModes.TWO_WAY) {
        warn('Prop "' + name + '" expects a two-way binding type.');
      }
    } else if ((value = getAttr(el, attr)) !== null) {
      // has literal binding!
      prop.raw = value;
    } else if (options.required) {
      // warn missing required
      process.env.NODE_ENV !== 'production' && warn('Missing required prop: ' + name);
    }
    // push prop
    props.push(prop);
  }
  return makePropsLinkFn(props);
}

/**
 * Build a function that applies props to a vm.
 *
 * @param {Array} props
 * @return {Function} propsLinkFn
 */

function makePropsLinkFn(props) {
  return function propsLinkFn(vm, scope) {
    // store resolved props info
    vm._props = {};
    var i = props.length;
    var prop, path, options, value, raw;
    while (i--) {
      prop = props[i];
      raw = prop.raw;
      path = prop.path;
      options = prop.options;
      vm._props[path] = prop;
      if (raw === null) {
        // initialize absent prop
        initProp(vm, prop, getDefault(vm, options));
      } else if (prop.dynamic) {
        // dynamic prop
        if (vm._context) {
          if (prop.mode === propBindingModes.ONE_TIME) {
            // one time binding
            value = (scope || vm._context).$get(prop.parentPath);
            initProp(vm, prop, value);
          } else {
            // dynamic binding
            vm._bindDir({
              name: 'prop',
              def: propDef,
              prop: prop
            }, null, null, scope); // el, host, scope
          }
        } else {
            process.env.NODE_ENV !== 'production' && warn('Cannot bind dynamic prop on a root instance' + ' with no parent: ' + prop.name + '="' + raw + '"');
          }
      } else if (prop.optimizedLiteral) {
        // optimized literal, cast it and just set once
        var stripped = stripQuotes(raw);
        value = stripped === raw ? toBoolean(toNumber(raw)) : stripped;
        initProp(vm, prop, value);
      } else {
        // string literal, but we need to cater for
        // Boolean props with no value
        value = options.type === Boolean && raw === '' ? true : raw;
        initProp(vm, prop, value);
      }
    }
  };
}

/**
 * Get the default value of a prop.
 *
 * @param {Vue} vm
 * @param {Object} options
 * @return {*}
 */

function getDefault(vm, options) {
  // no default, return undefined
  if (!hasOwn(options, 'default')) {
    // absent boolean value defaults to false
    return options.type === Boolean ? false : undefined;
  }
  var def = options['default'];
  // warn against non-factory defaults for Object & Array
  if (isObject(def)) {
    process.env.NODE_ENV !== 'production' && warn('Object/Array as default prop values will be shared ' + 'across multiple instances. Use a factory function ' + 'to return the default value instead.');
  }
  // call factory function for non-Function types
  return typeof def === 'function' && options.type !== Function ? def.call(vm) : def;
}

// special binding prefixes
var bindRE = /^v-bind:|^:/;
var onRE = /^v-on:|^@/;
var argRE = /:(.*)$/;
var modifierRE = /\.[^\.]+/g;
var transitionRE = /^(v-bind:|:)?transition$/;

// terminal directives
var terminalDirectives = ['for', 'if'];

// default directive priority
var DEFAULT_PRIORITY = 1000;

/**
 * Compile a template and return a reusable composite link
 * function, which recursively contains more link functions
 * inside. This top level compile function would normally
 * be called on instance root nodes, but can also be used
 * for partial compilation if the partial argument is true.
 *
 * The returned composite link function, when called, will
 * return an unlink function that tearsdown all directives
 * created during the linking phase.
 *
 * @param {Element|DocumentFragment} el
 * @param {Object} options
 * @param {Boolean} partial
 * @return {Function}
 */

function compile(el, options, partial) {
  // link function for the node itself.
  var nodeLinkFn = partial || !options._asComponent ? compileNode(el, options) : null;
  // link function for the childNodes
  var childLinkFn = !(nodeLinkFn && nodeLinkFn.terminal) && el.tagName !== 'SCRIPT' && el.hasChildNodes() ? compileNodeList(el.childNodes, options) : null;

  /**
   * A composite linker function to be called on a already
   * compiled piece of DOM, which instantiates all directive
   * instances.
   *
   * @param {Vue} vm
   * @param {Element|DocumentFragment} el
   * @param {Vue} [host] - host vm of transcluded content
   * @param {Object} [scope] - v-for scope
   * @param {Fragment} [frag] - link context fragment
   * @return {Function|undefined}
   */

  return function compositeLinkFn(vm, el, host, scope, frag) {
    // cache childNodes before linking parent, fix #657
    var childNodes = toArray(el.childNodes);
    // link
    var dirs = linkAndCapture(function compositeLinkCapturer() {
      if (nodeLinkFn) nodeLinkFn(vm, el, host, scope, frag);
      if (childLinkFn) childLinkFn(vm, childNodes, host, scope, frag);
    }, vm);
    return makeUnlinkFn(vm, dirs);
  };
}

/**
 * Apply a linker to a vm/element pair and capture the
 * directives created during the process.
 *
 * @param {Function} linker
 * @param {Vue} vm
 */

function linkAndCapture(linker, vm) {
  var originalDirCount = vm._directives.length;
  linker();
  var dirs = vm._directives.slice(originalDirCount);
  dirs.sort(directiveComparator);
  for (var i = 0, l = dirs.length; i < l; i++) {
    dirs[i]._bind();
  }
  return dirs;
}

/**
 * Directive priority sort comparator
 *
 * @param {Object} a
 * @param {Object} b
 */

function directiveComparator(a, b) {
  a = a.descriptor.def.priority || DEFAULT_PRIORITY;
  b = b.descriptor.def.priority || DEFAULT_PRIORITY;
  return a > b ? -1 : a === b ? 0 : 1;
}

/**
 * Linker functions return an unlink function that
 * tearsdown all directives instances generated during
 * the process.
 *
 * We create unlink functions with only the necessary
 * information to avoid retaining additional closures.
 *
 * @param {Vue} vm
 * @param {Array} dirs
 * @param {Vue} [context]
 * @param {Array} [contextDirs]
 * @return {Function}
 */

function makeUnlinkFn(vm, dirs, context, contextDirs) {
  return function unlink(destroying) {
    teardownDirs(vm, dirs, destroying);
    if (context && contextDirs) {
      teardownDirs(context, contextDirs);
    }
  };
}

/**
 * Teardown partial linked directives.
 *
 * @param {Vue} vm
 * @param {Array} dirs
 * @param {Boolean} destroying
 */

function teardownDirs(vm, dirs, destroying) {
  var i = dirs.length;
  while (i--) {
    dirs[i]._teardown();
    if (!destroying) {
      vm._directives.$remove(dirs[i]);
    }
  }
}

/**
 * Compile link props on an instance.
 *
 * @param {Vue} vm
 * @param {Element} el
 * @param {Object} props
 * @param {Object} [scope]
 * @return {Function}
 */

function compileAndLinkProps(vm, el, props, scope) {
  var propsLinkFn = compileProps(el, props);
  var propDirs = linkAndCapture(function () {
    propsLinkFn(vm, scope);
  }, vm);
  return makeUnlinkFn(vm, propDirs);
}

/**
 * Compile the root element of an instance.
 *
 * 1. attrs on context container (context scope)
 * 2. attrs on the component template root node, if
 *    replace:true (child scope)
 *
 * If this is a fragment instance, we only need to compile 1.
 *
 * @param {Vue} vm
 * @param {Element} el
 * @param {Object} options
 * @param {Object} contextOptions
 * @return {Function}
 */

function compileRoot(el, options, contextOptions) {
  var containerAttrs = options._containerAttrs;
  var replacerAttrs = options._replacerAttrs;
  var contextLinkFn, replacerLinkFn;

  // only need to compile other attributes for
  // non-fragment instances
  if (el.nodeType !== 11) {
    // for components, container and replacer need to be
    // compiled separately and linked in different scopes.
    if (options._asComponent) {
      // 2. container attributes
      if (containerAttrs && contextOptions) {
        contextLinkFn = compileDirectives(containerAttrs, contextOptions);
      }
      if (replacerAttrs) {
        // 3. replacer attributes
        replacerLinkFn = compileDirectives(replacerAttrs, options);
      }
    } else {
      // non-component, just compile as a normal element.
      replacerLinkFn = compileDirectives(el.attributes, options);
    }
  } else if (process.env.NODE_ENV !== 'production' && containerAttrs) {
    // warn container directives for fragment instances
    var names = containerAttrs.filter(function (attr) {
      // allow vue-loader/vueify scoped css attributes
      return attr.name.indexOf('_v-') < 0 &&
      // allow event listeners
      !onRE.test(attr.name) &&
      // allow slots
      attr.name !== 'slot';
    }).map(function (attr) {
      return '"' + attr.name + '"';
    });
    if (names.length) {
      var plural = names.length > 1;
      warn('Attribute' + (plural ? 's ' : ' ') + names.join(', ') + (plural ? ' are' : ' is') + ' ignored on component ' + '<' + options.el.tagName.toLowerCase() + '> because ' + 'the component is a fragment instance: ' + 'http://vuejs.org/guide/components.html#Fragment_Instance');
    }
  }

  return function rootLinkFn(vm, el, scope) {
    // link context scope dirs
    var context = vm._context;
    var contextDirs;
    if (context && contextLinkFn) {
      contextDirs = linkAndCapture(function () {
        contextLinkFn(context, el, null, scope);
      }, context);
    }

    // link self
    var selfDirs = linkAndCapture(function () {
      if (replacerLinkFn) replacerLinkFn(vm, el);
    }, vm);

    // return the unlink function that tearsdown context
    // container directives.
    return makeUnlinkFn(vm, selfDirs, context, contextDirs);
  };
}

/**
 * Compile a node and return a nodeLinkFn based on the
 * node type.
 *
 * @param {Node} node
 * @param {Object} options
 * @return {Function|null}
 */

function compileNode(node, options) {
  var type = node.nodeType;
  if (type === 1 && node.tagName !== 'SCRIPT') {
    return compileElement(node, options);
  } else if (type === 3 && node.data.trim()) {
    return compileTextNode(node, options);
  } else {
    return null;
  }
}

/**
 * Compile an element and return a nodeLinkFn.
 *
 * @param {Element} el
 * @param {Object} options
 * @return {Function|null}
 */

function compileElement(el, options) {
  // preprocess textareas.
  // textarea treats its text content as the initial value.
  // just bind it as an attr directive for value.
  if (el.tagName === 'TEXTAREA') {
    var tokens = parseText(el.value);
    if (tokens) {
      el.setAttribute(':value', tokensToExp(tokens));
      el.value = '';
    }
  }
  var linkFn;
  var hasAttrs = el.hasAttributes();
  // check terminal directives (for & if)
  if (hasAttrs) {
    linkFn = checkTerminalDirectives(el, options);
  }
  // check element directives
  if (!linkFn) {
    linkFn = checkElementDirectives(el, options);
  }
  // check component
  if (!linkFn) {
    linkFn = checkComponent(el, options);
  }
  // normal directives
  if (!linkFn && hasAttrs) {
    linkFn = compileDirectives(el.attributes, options);
  }
  return linkFn;
}

/**
 * Compile a textNode and return a nodeLinkFn.
 *
 * @param {TextNode} node
 * @param {Object} options
 * @return {Function|null} textNodeLinkFn
 */

function compileTextNode(node, options) {
  // skip marked text nodes
  if (node._skip) {
    return removeText;
  }

  var tokens = parseText(node.wholeText);
  if (!tokens) {
    return null;
  }

  // mark adjacent text nodes as skipped,
  // because we are using node.wholeText to compile
  // all adjacent text nodes together. This fixes
  // issues in IE where sometimes it splits up a single
  // text node into multiple ones.
  var next = node.nextSibling;
  while (next && next.nodeType === 3) {
    next._skip = true;
    next = next.nextSibling;
  }

  var frag = document.createDocumentFragment();
  var el, token;
  for (var i = 0, l = tokens.length; i < l; i++) {
    token = tokens[i];
    el = token.tag ? processTextToken(token, options) : document.createTextNode(token.value);
    frag.appendChild(el);
  }
  return makeTextNodeLinkFn(tokens, frag, options);
}

/**
 * Linker for an skipped text node.
 *
 * @param {Vue} vm
 * @param {Text} node
 */

function removeText(vm, node) {
  remove(node);
}

/**
 * Process a single text token.
 *
 * @param {Object} token
 * @param {Object} options
 * @return {Node}
 */

function processTextToken(token, options) {
  var el;
  if (token.oneTime) {
    el = document.createTextNode(token.value);
  } else {
    if (token.html) {
      el = document.createComment('v-html');
      setTokenType('html');
    } else {
      // IE will clean up empty textNodes during
      // frag.cloneNode(true), so we have to give it
      // something here...
      el = document.createTextNode(' ');
      setTokenType('text');
    }
  }
  function setTokenType(type) {
    if (token.descriptor) return;
    var parsed = parseDirective(token.value);
    token.descriptor = {
      name: type,
      def: publicDirectives[type],
      expression: parsed.expression,
      filters: parsed.filters
    };
  }
  return el;
}

/**
 * Build a function that processes a textNode.
 *
 * @param {Array<Object>} tokens
 * @param {DocumentFragment} frag
 */

function makeTextNodeLinkFn(tokens, frag) {
  return function textNodeLinkFn(vm, el, host, scope) {
    var fragClone = frag.cloneNode(true);
    var childNodes = toArray(fragClone.childNodes);
    var token, value, node;
    for (var i = 0, l = tokens.length; i < l; i++) {
      token = tokens[i];
      value = token.value;
      if (token.tag) {
        node = childNodes[i];
        if (token.oneTime) {
          value = (scope || vm).$eval(value);
          if (token.html) {
            replace(node, parseTemplate(value, true));
          } else {
            node.data = value;
          }
        } else {
          vm._bindDir(token.descriptor, node, host, scope);
        }
      }
    }
    replace(el, fragClone);
  };
}

/**
 * Compile a node list and return a childLinkFn.
 *
 * @param {NodeList} nodeList
 * @param {Object} options
 * @return {Function|undefined}
 */

function compileNodeList(nodeList, options) {
  var linkFns = [];
  var nodeLinkFn, childLinkFn, node;
  for (var i = 0, l = nodeList.length; i < l; i++) {
    node = nodeList[i];
    nodeLinkFn = compileNode(node, options);
    childLinkFn = !(nodeLinkFn && nodeLinkFn.terminal) && node.tagName !== 'SCRIPT' && node.hasChildNodes() ? compileNodeList(node.childNodes, options) : null;
    linkFns.push(nodeLinkFn, childLinkFn);
  }
  return linkFns.length ? makeChildLinkFn(linkFns) : null;
}

/**
 * Make a child link function for a node's childNodes.
 *
 * @param {Array<Function>} linkFns
 * @return {Function} childLinkFn
 */

function makeChildLinkFn(linkFns) {
  return function childLinkFn(vm, nodes, host, scope, frag) {
    var node, nodeLinkFn, childrenLinkFn;
    for (var i = 0, n = 0, l = linkFns.length; i < l; n++) {
      node = nodes[n];
      nodeLinkFn = linkFns[i++];
      childrenLinkFn = linkFns[i++];
      // cache childNodes before linking parent, fix #657
      var childNodes = toArray(node.childNodes);
      if (nodeLinkFn) {
        nodeLinkFn(vm, node, host, scope, frag);
      }
      if (childrenLinkFn) {
        childrenLinkFn(vm, childNodes, host, scope, frag);
      }
    }
  };
}

/**
 * Check for element directives (custom elements that should
 * be resovled as terminal directives).
 *
 * @param {Element} el
 * @param {Object} options
 */

function checkElementDirectives(el, options) {
  var tag = el.tagName.toLowerCase();
  if (commonTagRE.test(tag)) return;
  // special case: give named slot a higher priority
  // than unnamed slots
  if (tag === 'slot' && hasBindAttr(el, 'name')) {
    tag = '_namedSlot';
  }
  var def = resolveAsset(options, 'elementDirectives', tag);
  if (def) {
    return makeTerminalNodeLinkFn(el, tag, '', options, def);
  }
}

/**
 * Check if an element is a component. If yes, return
 * a component link function.
 *
 * @param {Element} el
 * @param {Object} options
 * @return {Function|undefined}
 */

function checkComponent(el, options) {
  var component = checkComponentAttr(el, options);
  if (component) {
    var ref = findRef(el);
    var descriptor = {
      name: 'component',
      ref: ref,
      expression: component.id,
      def: internalDirectives.component,
      modifiers: {
        literal: !component.dynamic
      }
    };
    var componentLinkFn = function componentLinkFn(vm, el, host, scope, frag) {
      if (ref) {
        defineReactive((scope || vm).$refs, ref, null);
      }
      vm._bindDir(descriptor, el, host, scope, frag);
    };
    componentLinkFn.terminal = true;
    return componentLinkFn;
  }
}

/**
 * Check an element for terminal directives in fixed order.
 * If it finds one, return a terminal link function.
 *
 * @param {Element} el
 * @param {Object} options
 * @return {Function} terminalLinkFn
 */

function checkTerminalDirectives(el, options) {
  // skip v-pre
  if (getAttr(el, 'v-pre') !== null) {
    return skip;
  }
  // skip v-else block, but only if following v-if
  if (el.hasAttribute('v-else')) {
    var prev = el.previousElementSibling;
    if (prev && prev.hasAttribute('v-if')) {
      return skip;
    }
  }
  var value, dirName;
  for (var i = 0, l = terminalDirectives.length; i < l; i++) {
    dirName = terminalDirectives[i];
    /* eslint-disable no-cond-assign */
    if (value = el.getAttribute('v-' + dirName)) {
      return makeTerminalNodeLinkFn(el, dirName, value, options);
    }
    /* eslint-enable no-cond-assign */
  }
}

function skip() {}
skip.terminal = true;

/**
 * Build a node link function for a terminal directive.
 * A terminal link function terminates the current
 * compilation recursion and handles compilation of the
 * subtree in the directive.
 *
 * @param {Element} el
 * @param {String} dirName
 * @param {String} value
 * @param {Object} options
 * @param {Object} [def]
 * @return {Function} terminalLinkFn
 */

function makeTerminalNodeLinkFn(el, dirName, value, options, def) {
  var parsed = parseDirective(value);
  var descriptor = {
    name: dirName,
    expression: parsed.expression,
    filters: parsed.filters,
    raw: value,
    // either an element directive, or if/for
    def: def || publicDirectives[dirName]
  };
  // check ref for v-for and router-view
  if (dirName === 'for' || dirName === 'router-view') {
    descriptor.ref = findRef(el);
  }
  var fn = function terminalNodeLinkFn(vm, el, host, scope, frag) {
    if (descriptor.ref) {
      defineReactive((scope || vm).$refs, descriptor.ref, null);
    }
    vm._bindDir(descriptor, el, host, scope, frag);
  };
  fn.terminal = true;
  return fn;
}

/**
 * Compile the directives on an element and return a linker.
 *
 * @param {Array|NamedNodeMap} attrs
 * @param {Object} options
 * @return {Function}
 */

function compileDirectives(attrs, options) {
  var i = attrs.length;
  var dirs = [];
  var attr, name, value, rawName, rawValue, dirName, arg, modifiers, dirDef, tokens;
  while (i--) {
    attr = attrs[i];
    name = rawName = attr.name;
    value = rawValue = attr.value;
    tokens = parseText(value);
    // reset arg
    arg = null;
    // check modifiers
    modifiers = parseModifiers(name);
    name = name.replace(modifierRE, '');

    // attribute interpolations
    if (tokens) {
      value = tokensToExp(tokens);
      arg = name;
      pushDir('bind', publicDirectives.bind, true);
      // warn against mixing mustaches with v-bind
      if (process.env.NODE_ENV !== 'production') {
        if (name === 'class' && Array.prototype.some.call(attrs, function (attr) {
          return attr.name === ':class' || attr.name === 'v-bind:class';
        })) {
          warn('class="' + rawValue + '": Do not mix mustache interpolation ' + 'and v-bind for "class" on the same element. Use one or the other.');
        }
      }
    } else

      // special attribute: transition
      if (transitionRE.test(name)) {
        modifiers.literal = !bindRE.test(name);
        pushDir('transition', internalDirectives.transition);
      } else

        // event handlers
        if (onRE.test(name)) {
          arg = name.replace(onRE, '');
          pushDir('on', publicDirectives.on);
        } else

          // attribute bindings
          if (bindRE.test(name)) {
            dirName = name.replace(bindRE, '');
            if (dirName === 'style' || dirName === 'class') {
              pushDir(dirName, internalDirectives[dirName]);
            } else {
              arg = dirName;
              pushDir('bind', publicDirectives.bind);
            }
          } else

            // normal directives
            if (name.indexOf('v-') === 0) {
              // check arg
              arg = (arg = name.match(argRE)) && arg[1];
              if (arg) {
                name = name.replace(argRE, '');
              }
              // extract directive name
              dirName = name.slice(2);

              // skip v-else (when used with v-show)
              if (dirName === 'else') {
                continue;
              }

              dirDef = resolveAsset(options, 'directives', dirName);

              if (process.env.NODE_ENV !== 'production') {
                assertAsset(dirDef, 'directive', dirName);
              }

              if (dirDef) {
                pushDir(dirName, dirDef);
              }
            }
  }

  /**
   * Push a directive.
   *
   * @param {String} dirName
   * @param {Object|Function} def
   * @param {Boolean} [interp]
   */

  function pushDir(dirName, def, interp) {
    var parsed = parseDirective(value);
    dirs.push({
      name: dirName,
      attr: rawName,
      raw: rawValue,
      def: def,
      arg: arg,
      modifiers: modifiers,
      expression: parsed.expression,
      filters: parsed.filters,
      interp: interp
    });
  }

  if (dirs.length) {
    return makeNodeLinkFn(dirs);
  }
}

/**
 * Parse modifiers from directive attribute name.
 *
 * @param {String} name
 * @return {Object}
 */

function parseModifiers(name) {
  var res = Object.create(null);
  var match = name.match(modifierRE);
  if (match) {
    var i = match.length;
    while (i--) {
      res[match[i].slice(1)] = true;
    }
  }
  return res;
}

/**
 * Build a link function for all directives on a single node.
 *
 * @param {Array} directives
 * @return {Function} directivesLinkFn
 */

function makeNodeLinkFn(directives) {
  return function nodeLinkFn(vm, el, host, scope, frag) {
    // reverse apply because it's sorted low to high
    var i = directives.length;
    while (i--) {
      vm._bindDir(directives[i], el, host, scope, frag);
    }
  };
}

var specialCharRE = /[^\w\-:\.]/;

/**
 * Process an element or a DocumentFragment based on a
 * instance option object. This allows us to transclude
 * a template node/fragment before the instance is created,
 * so the processed fragment can then be cloned and reused
 * in v-for.
 *
 * @param {Element} el
 * @param {Object} options
 * @return {Element|DocumentFragment}
 */

function transclude(el, options) {
  // extract container attributes to pass them down
  // to compiler, because they need to be compiled in
  // parent scope. we are mutating the options object here
  // assuming the same object will be used for compile
  // right after this.
  if (options) {
    options._containerAttrs = extractAttrs(el);
  }
  // for template tags, what we want is its content as
  // a documentFragment (for fragment instances)
  if (isTemplate(el)) {
    el = parseTemplate(el);
  }
  if (options) {
    if (options._asComponent && !options.template) {
      options.template = '<slot></slot>';
    }
    if (options.template) {
      options._content = extractContent(el);
      el = transcludeTemplate(el, options);
    }
  }
  if (el instanceof DocumentFragment) {
    // anchors for fragment instance
    // passing in `persist: true` to avoid them being
    // discarded by IE during template cloning
    prepend(createAnchor('v-start', true), el);
    el.appendChild(createAnchor('v-end', true));
  }
  return el;
}

/**
 * Process the template option.
 * If the replace option is true this will swap the $el.
 *
 * @param {Element} el
 * @param {Object} options
 * @return {Element|DocumentFragment}
 */

function transcludeTemplate(el, options) {
  var template = options.template;
  var frag = parseTemplate(template, true);
  if (frag) {
    var replacer = frag.firstChild;
    var tag = replacer.tagName && replacer.tagName.toLowerCase();
    if (options.replace) {
      /* istanbul ignore if */
      if (el === document.body) {
        process.env.NODE_ENV !== 'production' && warn('You are mounting an instance with a template to ' + '<body>. This will replace <body> entirely. You ' + 'should probably use `replace: false` here.');
      }
      // there are many cases where the instance must
      // become a fragment instance: basically anything that
      // can create more than 1 root nodes.
      if (
      // multi-children template
      frag.childNodes.length > 1 ||
      // non-element template
      replacer.nodeType !== 1 ||
      // single nested component
      tag === 'component' || resolveAsset(options, 'components', tag) || hasBindAttr(replacer, 'is') ||
      // element directive
      resolveAsset(options, 'elementDirectives', tag) ||
      // for block
      replacer.hasAttribute('v-for') ||
      // if block
      replacer.hasAttribute('v-if')) {
        return frag;
      } else {
        options._replacerAttrs = extractAttrs(replacer);
        mergeAttrs(el, replacer);
        return replacer;
      }
    } else {
      el.appendChild(frag);
      return el;
    }
  } else {
    process.env.NODE_ENV !== 'production' && warn('Invalid template option: ' + template);
  }
}

/**
 * Helper to extract a component container's attributes
 * into a plain object array.
 *
 * @param {Element} el
 * @return {Array}
 */

function extractAttrs(el) {
  if (el.nodeType === 1 && el.hasAttributes()) {
    return toArray(el.attributes);
  }
}

/**
 * Merge the attributes of two elements, and make sure
 * the class names are merged properly.
 *
 * @param {Element} from
 * @param {Element} to
 */

function mergeAttrs(from, to) {
  var attrs = from.attributes;
  var i = attrs.length;
  var name, value;
  while (i--) {
    name = attrs[i].name;
    value = attrs[i].value;
    if (!to.hasAttribute(name) && !specialCharRE.test(name)) {
      to.setAttribute(name, value);
    } else if (name === 'class') {
      value.split(/\s+/).forEach(function (cls) {
        addClass(to, cls);
      });
    }
  }
}

var compiler = Object.freeze({
	compile: compile,
	compileAndLinkProps: compileAndLinkProps,
	compileRoot: compileRoot,
	transclude: transclude
});

function stateMixin (Vue) {

  /**
   * Accessor for `$data` property, since setting $data
   * requires observing the new object and updating
   * proxied properties.
   */

  Object.defineProperty(Vue.prototype, '$data', {
    get: function get() {
      return this._data;
    },
    set: function set(newData) {
      if (newData !== this._data) {
        this._setData(newData);
      }
    }
  });

  /**
   * Setup the scope of an instance, which contains:
   * - observed data
   * - computed properties
   * - user methods
   * - meta properties
   */

  Vue.prototype._initState = function () {
    this._initProps();
    this._initMeta();
    this._initMethods();
    this._initData();
    this._initComputed();
  };

  /**
   * Initialize props.
   */

  Vue.prototype._initProps = function () {
    var options = this.$options;
    var el = options.el;
    var props = options.props;
    if (props && !el) {
      process.env.NODE_ENV !== 'production' && warn('Props will not be compiled if no `el` option is ' + 'provided at instantiation.');
    }
    // make sure to convert string selectors into element now
    el = options.el = query(el);
    this._propsUnlinkFn = el && el.nodeType === 1 && props
    // props must be linked in proper scope if inside v-for
    ? compileAndLinkProps(this, el, props, this._scope) : null;
  };

  /**
   * Initialize the data.
   */

  Vue.prototype._initData = function () {
    var propsData = this._data;
    var optionsDataFn = this.$options.data;
    var optionsData = optionsDataFn && optionsDataFn();
    if (optionsData) {
      this._data = optionsData;
      for (var prop in propsData) {
        if (process.env.NODE_ENV !== 'production' && hasOwn(optionsData, prop)) {
          warn('Data field "' + prop + '" is already defined ' + 'as a prop. Use prop default value instead.');
        }
        if (this._props[prop].raw !== null || !hasOwn(optionsData, prop)) {
          set(optionsData, prop, propsData[prop]);
        }
      }
    }
    var data = this._data;
    // proxy data on instance
    var keys = Object.keys(data);
    var i, key;
    i = keys.length;
    while (i--) {
      key = keys[i];
      this._proxy(key);
    }
    // observe data
    observe(data, this);
  };

  /**
   * Swap the instance's $data. Called in $data's setter.
   *
   * @param {Object} newData
   */

  Vue.prototype._setData = function (newData) {
    newData = newData || {};
    var oldData = this._data;
    this._data = newData;
    var keys, key, i;
    // unproxy keys not present in new data
    keys = Object.keys(oldData);
    i = keys.length;
    while (i--) {
      key = keys[i];
      if (!(key in newData)) {
        this._unproxy(key);
      }
    }
    // proxy keys not already proxied,
    // and trigger change for changed values
    keys = Object.keys(newData);
    i = keys.length;
    while (i--) {
      key = keys[i];
      if (!hasOwn(this, key)) {
        // new property
        this._proxy(key);
      }
    }
    oldData.__ob__.removeVm(this);
    observe(newData, this);
    this._digest();
  };

  /**
   * Proxy a property, so that
   * vm.prop === vm._data.prop
   *
   * @param {String} key
   */

  Vue.prototype._proxy = function (key) {
    if (!isReserved(key)) {
      // need to store ref to self here
      // because these getter/setters might
      // be called by child scopes via
      // prototype inheritance.
      var self = this;
      Object.defineProperty(self, key, {
        configurable: true,
        enumerable: true,
        get: function proxyGetter() {
          return self._data[key];
        },
        set: function proxySetter(val) {
          self._data[key] = val;
        }
      });
    }
  };

  /**
   * Unproxy a property.
   *
   * @param {String} key
   */

  Vue.prototype._unproxy = function (key) {
    if (!isReserved(key)) {
      delete this[key];
    }
  };

  /**
   * Force update on every watcher in scope.
   */

  Vue.prototype._digest = function () {
    for (var i = 0, l = this._watchers.length; i < l; i++) {
      this._watchers[i].update(true); // shallow updates
    }
  };

  /**
   * Setup computed properties. They are essentially
   * special getter/setters
   */

  function noop() {}
  Vue.prototype._initComputed = function () {
    var computed = this.$options.computed;
    if (computed) {
      for (var key in computed) {
        var userDef = computed[key];
        var def = {
          enumerable: true,
          configurable: true
        };
        if (typeof userDef === 'function') {
          def.get = makeComputedGetter(userDef, this);
          def.set = noop;
        } else {
          def.get = userDef.get ? userDef.cache !== false ? makeComputedGetter(userDef.get, this) : bind$1(userDef.get, this) : noop;
          def.set = userDef.set ? bind$1(userDef.set, this) : noop;
        }
        Object.defineProperty(this, key, def);
      }
    }
  };

  function makeComputedGetter(getter, owner) {
    var watcher = new Watcher(owner, getter, null, {
      lazy: true
    });
    return function computedGetter() {
      if (watcher.dirty) {
        watcher.evaluate();
      }
      if (Dep.target) {
        watcher.depend();
      }
      return watcher.value;
    };
  }

  /**
   * Setup instance methods. Methods must be bound to the
   * instance since they might be passed down as a prop to
   * child components.
   */

  Vue.prototype._initMethods = function () {
    var methods = this.$options.methods;
    if (methods) {
      for (var key in methods) {
        this[key] = bind$1(methods[key], this);
      }
    }
  };

  /**
   * Initialize meta information like $index, $key & $value.
   */

  Vue.prototype._initMeta = function () {
    var metas = this.$options._meta;
    if (metas) {
      for (var key in metas) {
        defineReactive(this, key, metas[key]);
      }
    }
  };
}

var eventRE = /^v-on:|^@/;

function eventsMixin (Vue) {

  /**
   * Setup the instance's option events & watchers.
   * If the value is a string, we pull it from the
   * instance's methods by name.
   */

  Vue.prototype._initEvents = function () {
    var options = this.$options;
    if (options._asComponent) {
      registerComponentEvents(this, options.el);
    }
    registerCallbacks(this, '$on', options.events);
    registerCallbacks(this, '$watch', options.watch);
  };

  /**
   * Register v-on events on a child component
   *
   * @param {Vue} vm
   * @param {Element} el
   */

  function registerComponentEvents(vm, el) {
    var attrs = el.attributes;
    var name, handler;
    for (var i = 0, l = attrs.length; i < l; i++) {
      name = attrs[i].name;
      if (eventRE.test(name)) {
        name = name.replace(eventRE, '');
        handler = (vm._scope || vm._context).$eval(attrs[i].value, true);
        vm.$on(name.replace(eventRE), handler);
      }
    }
  }

  /**
   * Register callbacks for option events and watchers.
   *
   * @param {Vue} vm
   * @param {String} action
   * @param {Object} hash
   */

  function registerCallbacks(vm, action, hash) {
    if (!hash) return;
    var handlers, key, i, j;
    for (key in hash) {
      handlers = hash[key];
      if (isArray(handlers)) {
        for (i = 0, j = handlers.length; i < j; i++) {
          register(vm, action, key, handlers[i]);
        }
      } else {
        register(vm, action, key, handlers);
      }
    }
  }

  /**
   * Helper to register an event/watch callback.
   *
   * @param {Vue} vm
   * @param {String} action
   * @param {String} key
   * @param {Function|String|Object} handler
   * @param {Object} [options]
   */

  function register(vm, action, key, handler, options) {
    var type = typeof handler;
    if (type === 'function') {
      vm[action](key, handler, options);
    } else if (type === 'string') {
      var methods = vm.$options.methods;
      var method = methods && methods[handler];
      if (method) {
        vm[action](key, method, options);
      } else {
        process.env.NODE_ENV !== 'production' && warn('Unknown method: "' + handler + '" when ' + 'registering callback for ' + action + ': "' + key + '".');
      }
    } else if (handler && type === 'object') {
      register(vm, action, key, handler.handler, handler);
    }
  }

  /**
   * Setup recursive attached/detached calls
   */

  Vue.prototype._initDOMHooks = function () {
    this.$on('hook:attached', onAttached);
    this.$on('hook:detached', onDetached);
  };

  /**
   * Callback to recursively call attached hook on children
   */

  function onAttached() {
    if (!this._isAttached) {
      this._isAttached = true;
      this.$children.forEach(callAttach);
    }
  }

  /**
   * Iterator to call attached hook
   *
   * @param {Vue} child
   */

  function callAttach(child) {
    if (!child._isAttached && inDoc(child.$el)) {
      child._callHook('attached');
    }
  }

  /**
   * Callback to recursively call detached hook on children
   */

  function onDetached() {
    if (this._isAttached) {
      this._isAttached = false;
      this.$children.forEach(callDetach);
    }
  }

  /**
   * Iterator to call detached hook
   *
   * @param {Vue} child
   */

  function callDetach(child) {
    if (child._isAttached && !inDoc(child.$el)) {
      child._callHook('detached');
    }
  }

  /**
   * Trigger all handlers for a hook
   *
   * @param {String} hook
   */

  Vue.prototype._callHook = function (hook) {
    this.$emit('pre-hook:' + hook);
    var handlers = this.$options[hook];
    if (handlers) {
      for (var i = 0, j = handlers.length; i < j; i++) {
        handlers[i].call(this);
      }
    }
    this.$emit('hook:' + hook);
  };
}

function noop() {}

/**
 * A directive links a DOM element with a piece of data,
 * which is the result of evaluating an expression.
 * It registers a watcher with the expression and calls
 * the DOM update function when a change is triggered.
 *
 * @param {String} name
 * @param {Node} el
 * @param {Vue} vm
 * @param {Object} descriptor
 *                 - {String} name
 *                 - {Object} def
 *                 - {String} expression
 *                 - {Array<Object>} [filters]
 *                 - {Boolean} literal
 *                 - {String} attr
 *                 - {String} raw
 * @param {Object} def - directive definition object
 * @param {Vue} [host] - transclusion host component
 * @param {Object} [scope] - v-for scope
 * @param {Fragment} [frag] - owner fragment
 * @constructor
 */
function Directive(descriptor, vm, el, host, scope, frag) {
  this.vm = vm;
  this.el = el;
  // copy descriptor properties
  this.descriptor = descriptor;
  this.name = descriptor.name;
  this.expression = descriptor.expression;
  this.arg = descriptor.arg;
  this.modifiers = descriptor.modifiers;
  this.filters = descriptor.filters;
  this.literal = this.modifiers && this.modifiers.literal;
  // private
  this._locked = false;
  this._bound = false;
  this._listeners = null;
  // link context
  this._host = host;
  this._scope = scope;
  this._frag = frag;
  // store directives on node in dev mode
  if (process.env.NODE_ENV !== 'production' && this.el) {
    this.el._vue_directives = this.el._vue_directives || [];
    this.el._vue_directives.push(this);
  }
}

/**
 * Initialize the directive, mixin definition properties,
 * setup the watcher, call definition bind() and update()
 * if present.
 *
 * @param {Object} def
 */

Directive.prototype._bind = function () {
  var name = this.name;
  var descriptor = this.descriptor;

  // remove attribute
  if ((name !== 'cloak' || this.vm._isCompiled) && this.el && this.el.removeAttribute) {
    var attr = descriptor.attr || 'v-' + name;
    this.el.removeAttribute(attr);
  }

  // copy def properties
  var def = descriptor.def;
  if (typeof def === 'function') {
    this.update = def;
  } else {
    extend(this, def);
  }

  // setup directive params
  this._setupParams();

  // initial bind
  if (this.bind) {
    this.bind();
  }
  this._bound = true;

  if (this.literal) {
    this.update && this.update(descriptor.raw);
  } else if ((this.expression || this.modifiers) && (this.update || this.twoWay) && !this._checkStatement()) {
    // wrapped updater for context
    var dir = this;
    if (this.update) {
      this._update = function (val, oldVal) {
        if (!dir._locked) {
          dir.update(val, oldVal);
        }
      };
    } else {
      this._update = noop;
    }
    var preProcess = this._preProcess ? bind$1(this._preProcess, this) : null;
    var postProcess = this._postProcess ? bind$1(this._postProcess, this) : null;
    var watcher = this._watcher = new Watcher(this.vm, this.expression, this._update, // callback
    {
      filters: this.filters,
      twoWay: this.twoWay,
      deep: this.deep,
      preProcess: preProcess,
      postProcess: postProcess,
      scope: this._scope
    });
    // v-model with inital inline value need to sync back to
    // model instead of update to DOM on init. They would
    // set the afterBind hook to indicate that.
    if (this.afterBind) {
      this.afterBind();
    } else if (this.update) {
      this.update(watcher.value);
    }
  }
};

/**
 * Setup all param attributes, e.g. track-by,
 * transition-mode, etc...
 */

Directive.prototype._setupParams = function () {
  if (!this.params) {
    return;
  }
  var params = this.params;
  // swap the params array with a fresh object.
  this.params = Object.create(null);
  var i = params.length;
  var key, val, mappedKey;
  while (i--) {
    key = params[i];
    mappedKey = camelize(key);
    val = getBindAttr(this.el, key);
    if (val != null) {
      // dynamic
      this._setupParamWatcher(mappedKey, val);
    } else {
      // static
      val = getAttr(this.el, key);
      if (val != null) {
        this.params[mappedKey] = val === '' ? true : val;
      }
    }
  }
};

/**
 * Setup a watcher for a dynamic param.
 *
 * @param {String} key
 * @param {String} expression
 */

Directive.prototype._setupParamWatcher = function (key, expression) {
  var self = this;
  var called = false;
  var unwatch = (this._scope || this.vm).$watch(expression, function (val, oldVal) {
    self.params[key] = val;
    // since we are in immediate mode,
    // only call the param change callbacks if this is not the first update.
    if (called) {
      var cb = self.paramWatchers && self.paramWatchers[key];
      if (cb) {
        cb.call(self, val, oldVal);
      }
    } else {
      called = true;
    }
  }, {
    immediate: true,
    user: false
  });(this._paramUnwatchFns || (this._paramUnwatchFns = [])).push(unwatch);
};

/**
 * Check if the directive is a function caller
 * and if the expression is a callable one. If both true,
 * we wrap up the expression and use it as the event
 * handler.
 *
 * e.g. on-click="a++"
 *
 * @return {Boolean}
 */

Directive.prototype._checkStatement = function () {
  var expression = this.expression;
  if (expression && this.acceptStatement && !isSimplePath(expression)) {
    var fn = parseExpression(expression).get;
    var scope = this._scope || this.vm;
    var handler = function handler(e) {
      scope.$event = e;
      fn.call(scope, scope);
      scope.$event = null;
    };
    if (this.filters) {
      handler = scope._applyFilters(handler, null, this.filters);
    }
    this.update(handler);
    return true;
  }
};

/**
 * Set the corresponding value with the setter.
 * This should only be used in two-way directives
 * e.g. v-model.
 *
 * @param {*} value
 * @public
 */

Directive.prototype.set = function (value) {
  /* istanbul ignore else */
  if (this.twoWay) {
    this._withLock(function () {
      this._watcher.set(value);
    });
  } else if (process.env.NODE_ENV !== 'production') {
    warn('Directive.set() can only be used inside twoWay' + 'directives.');
  }
};

/**
 * Execute a function while preventing that function from
 * triggering updates on this directive instance.
 *
 * @param {Function} fn
 */

Directive.prototype._withLock = function (fn) {
  var self = this;
  self._locked = true;
  fn.call(self);
  nextTick(function () {
    self._locked = false;
  });
};

/**
 * Convenience method that attaches a DOM event listener
 * to the directive element and autometically tears it down
 * during unbind.
 *
 * @param {String} event
 * @param {Function} handler
 */

Directive.prototype.on = function (event, handler) {
  on$1(this.el, event, handler);(this._listeners || (this._listeners = [])).push([event, handler]);
};

/**
 * Teardown the watcher and call unbind.
 */

Directive.prototype._teardown = function () {
  if (this._bound) {
    this._bound = false;
    if (this.unbind) {
      this.unbind();
    }
    if (this._watcher) {
      this._watcher.teardown();
    }
    var listeners = this._listeners;
    var i;
    if (listeners) {
      i = listeners.length;
      while (i--) {
        off(this.el, listeners[i][0], listeners[i][1]);
      }
    }
    var unwatchFns = this._paramUnwatchFns;
    if (unwatchFns) {
      i = unwatchFns.length;
      while (i--) {
        unwatchFns[i]();
      }
    }
    if (process.env.NODE_ENV !== 'production' && this.el) {
      this.el._vue_directives.$remove(this);
    }
    this.vm = this.el = this._watcher = this._listeners = null;
  }
};

function lifecycleMixin (Vue) {

  /**
   * Update v-ref for component.
   *
   * @param {Boolean} remove
   */

  Vue.prototype._updateRef = function (remove) {
    var ref = this.$options._ref;
    if (ref) {
      var refs = (this._scope || this._context).$refs;
      if (remove) {
        if (refs[ref] === this) {
          refs[ref] = null;
        }
      } else {
        refs[ref] = this;
      }
    }
  };

  /**
   * Transclude, compile and link element.
   *
   * If a pre-compiled linker is available, that means the
   * passed in element will be pre-transcluded and compiled
   * as well - all we need to do is to call the linker.
   *
   * Otherwise we need to call transclude/compile/link here.
   *
   * @param {Element} el
   * @return {Element}
   */

  Vue.prototype._compile = function (el) {
    var options = this.$options;

    // transclude and init element
    // transclude can potentially replace original
    // so we need to keep reference; this step also injects
    // the template and caches the original attributes
    // on the container node and replacer node.
    var original = el;
    el = transclude(el, options);
    this._initElement(el);

    // handle v-pre on root node (#2026)
    if (el.nodeType === 1 && getAttr(el, 'v-pre') !== null) {
      return;
    }

    // root is always compiled per-instance, because
    // container attrs and props can be different every time.
    var contextOptions = this._context && this._context.$options;
    var rootLinker = compileRoot(el, options, contextOptions);

    // compile and link the rest
    var contentLinkFn;
    var ctor = this.constructor;
    // component compilation can be cached
    // as long as it's not using inline-template
    if (options._linkerCachable) {
      contentLinkFn = ctor.linker;
      if (!contentLinkFn) {
        contentLinkFn = ctor.linker = compile(el, options);
      }
    }

    // link phase
    // make sure to link root with prop scope!
    var rootUnlinkFn = rootLinker(this, el, this._scope);
    var contentUnlinkFn = contentLinkFn ? contentLinkFn(this, el) : compile(el, options)(this, el);

    // register composite unlink function
    // to be called during instance destruction
    this._unlinkFn = function () {
      rootUnlinkFn();
      // passing destroying: true to avoid searching and
      // splicing the directives
      contentUnlinkFn(true);
    };

    // finally replace original
    if (options.replace) {
      replace(original, el);
    }

    this._isCompiled = true;
    this._callHook('compiled');
    return el;
  };

  /**
   * Initialize instance element. Called in the public
   * $mount() method.
   *
   * @param {Element} el
   */

  Vue.prototype._initElement = function (el) {
    if (el instanceof DocumentFragment) {
      this._isFragment = true;
      this.$el = this._fragmentStart = el.firstChild;
      this._fragmentEnd = el.lastChild;
      // set persisted text anchors to empty
      if (this._fragmentStart.nodeType === 3) {
        this._fragmentStart.data = this._fragmentEnd.data = '';
      }
      this._fragment = el;
    } else {
      this.$el = el;
    }
    this.$el.__vue__ = this;
    this._callHook('beforeCompile');
  };

  /**
   * Create and bind a directive to an element.
   *
   * @param {String} name - directive name
   * @param {Node} node   - target node
   * @param {Object} desc - parsed directive descriptor
   * @param {Object} def  - directive definition object
   * @param {Vue} [host] - transclusion host component
   * @param {Object} [scope] - v-for scope
   * @param {Fragment} [frag] - owner fragment
   */

  Vue.prototype._bindDir = function (descriptor, node, host, scope, frag) {
    this._directives.push(new Directive(descriptor, this, node, host, scope, frag));
  };

  /**
   * Teardown an instance, unobserves the data, unbind all the
   * directives, turn off all the event listeners, etc.
   *
   * @param {Boolean} remove - whether to remove the DOM node.
   * @param {Boolean} deferCleanup - if true, defer cleanup to
   *                                 be called later
   */

  Vue.prototype._destroy = function (remove, deferCleanup) {
    if (this._isBeingDestroyed) {
      if (!deferCleanup) {
        this._cleanup();
      }
      return;
    }

    var destroyReady;
    var pendingRemoval;

    var self = this;
    // Cleanup should be called either synchronously or asynchronoysly as
    // callback of this.$remove(), or if remove and deferCleanup are false.
    // In any case it should be called after all other removing, unbinding and
    // turning of is done
    var cleanupIfPossible = function cleanupIfPossible() {
      if (destroyReady && !pendingRemoval && !deferCleanup) {
        self._cleanup();
      }
    };

    // remove DOM element
    if (remove && this.$el) {
      pendingRemoval = true;
      this.$remove(function () {
        pendingRemoval = false;
        cleanupIfPossible();
      });
    }

    this._callHook('beforeDestroy');
    this._isBeingDestroyed = true;
    var i;
    // remove self from parent. only necessary
    // if parent is not being destroyed as well.
    var parent = this.$parent;
    if (parent && !parent._isBeingDestroyed) {
      parent.$children.$remove(this);
      // unregister ref (remove: true)
      this._updateRef(true);
    }
    // destroy all children.
    i = this.$children.length;
    while (i--) {
      this.$children[i].$destroy();
    }
    // teardown props
    if (this._propsUnlinkFn) {
      this._propsUnlinkFn();
    }
    // teardown all directives. this also tearsdown all
    // directive-owned watchers.
    if (this._unlinkFn) {
      this._unlinkFn();
    }
    i = this._watchers.length;
    while (i--) {
      this._watchers[i].teardown();
    }
    // remove reference to self on $el
    if (this.$el) {
      this.$el.__vue__ = null;
    }

    destroyReady = true;
    cleanupIfPossible();
  };

  /**
   * Clean up to ensure garbage collection.
   * This is called after the leave transition if there
   * is any.
   */

  Vue.prototype._cleanup = function () {
    if (this._isDestroyed) {
      return;
    }
    // remove self from owner fragment
    // do it in cleanup so that we can call $destroy with
    // defer right when a fragment is about to be removed.
    if (this._frag) {
      this._frag.children.$remove(this);
    }
    // remove reference from data ob
    // frozen object may not have observer.
    if (this._data.__ob__) {
      this._data.__ob__.removeVm(this);
    }
    // Clean up references to private properties and other
    // instances. preserve reference to _data so that proxy
    // accessors still work. The only potential side effect
    // here is that mutating the instance after it's destroyed
    // may affect the state of other components that are still
    // observing the same object, but that seems to be a
    // reasonable responsibility for the user rather than
    // always throwing an error on them.
    this.$el = this.$parent = this.$root = this.$children = this._watchers = this._context = this._scope = this._directives = null;
    // call the last hook...
    this._isDestroyed = true;
    this._callHook('destroyed');
    // turn off all instance listeners.
    this.$off();
  };
}

function miscMixin (Vue) {

  /**
   * Apply a list of filter (descriptors) to a value.
   * Using plain for loops here because this will be called in
   * the getter of any watcher with filters so it is very
   * performance sensitive.
   *
   * @param {*} value
   * @param {*} [oldValue]
   * @param {Array} filters
   * @param {Boolean} write
   * @return {*}
   */

  Vue.prototype._applyFilters = function (value, oldValue, filters, write) {
    var filter, fn, args, arg, offset, i, l, j, k;
    for (i = 0, l = filters.length; i < l; i++) {
      filter = filters[i];
      fn = resolveAsset(this.$options, 'filters', filter.name);
      if (process.env.NODE_ENV !== 'production') {
        assertAsset(fn, 'filter', filter.name);
      }
      if (!fn) continue;
      fn = write ? fn.write : fn.read || fn;
      if (typeof fn !== 'function') continue;
      args = write ? [value, oldValue] : [value];
      offset = write ? 2 : 1;
      if (filter.args) {
        for (j = 0, k = filter.args.length; j < k; j++) {
          arg = filter.args[j];
          args[j + offset] = arg.dynamic ? this.$get(arg.value) : arg.value;
        }
      }
      value = fn.apply(this, args);
    }
    return value;
  };

  /**
   * Resolve a component, depending on whether the component
   * is defined normally or using an async factory function.
   * Resolves synchronously if already resolved, otherwise
   * resolves asynchronously and caches the resolved
   * constructor on the factory.
   *
   * @param {String} id
   * @param {Function} cb
   */

  Vue.prototype._resolveComponent = function (id, cb) {
    var factory = resolveAsset(this.$options, 'components', id);
    if (process.env.NODE_ENV !== 'production') {
      assertAsset(factory, 'component', id);
    }
    if (!factory) {
      return;
    }
    // async component factory
    if (!factory.options) {
      if (factory.resolved) {
        // cached
        cb(factory.resolved);
      } else if (factory.requested) {
        // pool callbacks
        factory.pendingCallbacks.push(cb);
      } else {
        factory.requested = true;
        var cbs = factory.pendingCallbacks = [cb];
        factory(function resolve(res) {
          if (isPlainObject(res)) {
            res = Vue.extend(res);
          }
          // cache resolved
          factory.resolved = res;
          // invoke callbacks
          for (var i = 0, l = cbs.length; i < l; i++) {
            cbs[i](res);
          }
        }, function reject(reason) {
          process.env.NODE_ENV !== 'production' && warn('Failed to resolve async component: ' + id + '. ' + (reason ? '\nReason: ' + reason : ''));
        });
      }
    } else {
      // normal component
      cb(factory);
    }
  };
}

function globalAPI (Vue) {

  /**
   * Expose useful internals
   */

  Vue.util = util;
  Vue.config = config;
  Vue.set = set;
  Vue['delete'] = del;
  Vue.nextTick = nextTick;

  /**
   * The following are exposed for advanced usage / plugins
   */

  Vue.compiler = compiler;
  Vue.FragmentFactory = FragmentFactory;
  Vue.internalDirectives = internalDirectives;
  Vue.parsers = {
    path: path,
    text: text$1,
    template: template,
    directive: directive,
    expression: expression
  };

  /**
   * Each instance constructor, including Vue, has a unique
   * cid. This enables us to create wrapped "child
   * constructors" for prototypal inheritance and cache them.
   */

  Vue.cid = 0;
  var cid = 1;

  /**
   * Class inheritance
   *
   * @param {Object} extendOptions
   */

  Vue.extend = function (extendOptions) {
    extendOptions = extendOptions || {};
    var Super = this;
    var isFirstExtend = Super.cid === 0;
    if (isFirstExtend && extendOptions._Ctor) {
      return extendOptions._Ctor;
    }
    var name = extendOptions.name || Super.options.name;
    if (process.env.NODE_ENV !== 'production') {
      if (!/^[a-zA-Z][\w-]+$/.test(name)) {
        warn('Invalid component name: ' + name);
        name = null;
      }
    }
    var Sub = createClass(name || 'VueComponent');
    Sub.prototype = Object.create(Super.prototype);
    Sub.prototype.constructor = Sub;
    Sub.cid = cid++;
    Sub.options = mergeOptions(Super.options, extendOptions);
    Sub['super'] = Super;
    // allow further extension
    Sub.extend = Super.extend;
    // create asset registers, so extended classes
    // can have their private assets too.
    config._assetTypes.forEach(function (type) {
      Sub[type] = Super[type];
    });
    // enable recursive self-lookup
    if (name) {
      Sub.options.components[name] = Sub;
    }
    // cache constructor
    if (isFirstExtend) {
      extendOptions._Ctor = Sub;
    }
    return Sub;
  };

  /**
   * A function that returns a sub-class constructor with the
   * given name. This gives us much nicer output when
   * logging instances in the console.
   *
   * @param {String} name
   * @return {Function}
   */

  function createClass(name) {
    return new Function('return function ' + classify(name) + ' (options) { this._init(options) }')();
  }

  /**
   * Plugin system
   *
   * @param {Object} plugin
   */

  Vue.use = function (plugin) {
    /* istanbul ignore if */
    if (plugin.installed) {
      return;
    }
    // additional parameters
    var args = toArray(arguments, 1);
    args.unshift(this);
    if (typeof plugin.install === 'function') {
      plugin.install.apply(plugin, args);
    } else {
      plugin.apply(null, args);
    }
    plugin.installed = true;
    return this;
  };

  /**
   * Apply a global mixin by merging it into the default
   * options.
   */

  Vue.mixin = function (mixin) {
    Vue.options = mergeOptions(Vue.options, mixin);
  };

  /**
   * Create asset registration methods with the following
   * signature:
   *
   * @param {String} id
   * @param {*} definition
   */

  config._assetTypes.forEach(function (type) {
    Vue[type] = function (id, definition) {
      if (!definition) {
        return this.options[type + 's'][id];
      } else {
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production') {
          if (type === 'component' && (commonTagRE.test(id) || reservedTagRE.test(id))) {
            warn('Do not use built-in or reserved HTML elements as component ' + 'id: ' + id);
          }
        }
        if (type === 'component' && isPlainObject(definition)) {
          definition.name = id;
          definition = Vue.extend(definition);
        }
        this.options[type + 's'][id] = definition;
        return definition;
      }
    };
  });
}

var filterRE = /[^|]\|[^|]/;

function dataAPI (Vue) {

  /**
   * Get the value from an expression on this vm.
   *
   * @param {String} exp
   * @param {Boolean} [asStatement]
   * @return {*}
   */

  Vue.prototype.$get = function (exp, asStatement) {
    var res = parseExpression(exp);
    if (res) {
      if (asStatement && !isSimplePath(exp)) {
        var self = this;
        return function statementHandler() {
          self.$arguments = toArray(arguments);
          res.get.call(self, self);
          self.$arguments = null;
        };
      } else {
        try {
          return res.get.call(this, this);
        } catch (e) {}
      }
    }
  };

  /**
   * Set the value from an expression on this vm.
   * The expression must be a valid left-hand
   * expression in an assignment.
   *
   * @param {String} exp
   * @param {*} val
   */

  Vue.prototype.$set = function (exp, val) {
    var res = parseExpression(exp, true);
    if (res && res.set) {
      res.set.call(this, this, val);
    }
  };

  /**
   * Delete a property on the VM
   *
   * @param {String} key
   */

  Vue.prototype.$delete = function (key) {
    del(this._data, key);
  };

  /**
   * Watch an expression, trigger callback when its
   * value changes.
   *
   * @param {String|Function} expOrFn
   * @param {Function} cb
   * @param {Object} [options]
   *                 - {Boolean} deep
   *                 - {Boolean} immediate
   * @return {Function} - unwatchFn
   */

  Vue.prototype.$watch = function (expOrFn, cb, options) {
    var vm = this;
    var parsed;
    if (typeof expOrFn === 'string') {
      parsed = parseDirective(expOrFn);
      expOrFn = parsed.expression;
    }
    var watcher = new Watcher(vm, expOrFn, cb, {
      deep: options && options.deep,
      sync: options && options.sync,
      filters: parsed && parsed.filters,
      user: !options || options.user !== false
    });
    if (options && options.immediate) {
      cb.call(vm, watcher.value);
    }
    return function unwatchFn() {
      watcher.teardown();
    };
  };

  /**
   * Evaluate a text directive, including filters.
   *
   * @param {String} text
   * @param {Boolean} [asStatement]
   * @return {String}
   */

  Vue.prototype.$eval = function (text, asStatement) {
    // check for filters.
    if (filterRE.test(text)) {
      var dir = parseDirective(text);
      // the filter regex check might give false positive
      // for pipes inside strings, so it's possible that
      // we don't get any filters here
      var val = this.$get(dir.expression, asStatement);
      return dir.filters ? this._applyFilters(val, null, dir.filters) : val;
    } else {
      // no filter
      return this.$get(text, asStatement);
    }
  };

  /**
   * Interpolate a piece of template text.
   *
   * @param {String} text
   * @return {String}
   */

  Vue.prototype.$interpolate = function (text) {
    var tokens = parseText(text);
    var vm = this;
    if (tokens) {
      if (tokens.length === 1) {
        return vm.$eval(tokens[0].value) + '';
      } else {
        return tokens.map(function (token) {
          return token.tag ? vm.$eval(token.value) : token.value;
        }).join('');
      }
    } else {
      return text;
    }
  };

  /**
   * Log instance data as a plain JS object
   * so that it is easier to inspect in console.
   * This method assumes console is available.
   *
   * @param {String} [path]
   */

  Vue.prototype.$log = function (path) {
    var data = path ? getPath(this._data, path) : this._data;
    if (data) {
      data = clean(data);
    }
    // include computed fields
    if (!path) {
      for (var key in this.$options.computed) {
        data[key] = clean(this[key]);
      }
    }
    console.log(data);
  };

  /**
   * "clean" a getter/setter converted object into a plain
   * object copy.
   *
   * @param {Object} - obj
   * @return {Object}
   */

  function clean(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
}

function domAPI (Vue) {

  /**
   * Convenience on-instance nextTick. The callback is
   * auto-bound to the instance, and this avoids component
   * modules having to rely on the global Vue.
   *
   * @param {Function} fn
   */

  Vue.prototype.$nextTick = function (fn) {
    nextTick(fn, this);
  };

  /**
   * Append instance to target
   *
   * @param {Node} target
   * @param {Function} [cb]
   * @param {Boolean} [withTransition] - defaults to true
   */

  Vue.prototype.$appendTo = function (target, cb, withTransition) {
    return insert(this, target, cb, withTransition, append, appendWithTransition);
  };

  /**
   * Prepend instance to target
   *
   * @param {Node} target
   * @param {Function} [cb]
   * @param {Boolean} [withTransition] - defaults to true
   */

  Vue.prototype.$prependTo = function (target, cb, withTransition) {
    target = query(target);
    if (target.hasChildNodes()) {
      this.$before(target.firstChild, cb, withTransition);
    } else {
      this.$appendTo(target, cb, withTransition);
    }
    return this;
  };

  /**
   * Insert instance before target
   *
   * @param {Node} target
   * @param {Function} [cb]
   * @param {Boolean} [withTransition] - defaults to true
   */

  Vue.prototype.$before = function (target, cb, withTransition) {
    return insert(this, target, cb, withTransition, beforeWithCb, beforeWithTransition);
  };

  /**
   * Insert instance after target
   *
   * @param {Node} target
   * @param {Function} [cb]
   * @param {Boolean} [withTransition] - defaults to true
   */

  Vue.prototype.$after = function (target, cb, withTransition) {
    target = query(target);
    if (target.nextSibling) {
      this.$before(target.nextSibling, cb, withTransition);
    } else {
      this.$appendTo(target.parentNode, cb, withTransition);
    }
    return this;
  };

  /**
   * Remove instance from DOM
   *
   * @param {Function} [cb]
   * @param {Boolean} [withTransition] - defaults to true
   */

  Vue.prototype.$remove = function (cb, withTransition) {
    if (!this.$el.parentNode) {
      return cb && cb();
    }
    var inDocument = this._isAttached && inDoc(this.$el);
    // if we are not in document, no need to check
    // for transitions
    if (!inDocument) withTransition = false;
    var self = this;
    var realCb = function realCb() {
      if (inDocument) self._callHook('detached');
      if (cb) cb();
    };
    if (this._isFragment) {
      removeNodeRange(this._fragmentStart, this._fragmentEnd, this, this._fragment, realCb);
    } else {
      var op = withTransition === false ? removeWithCb : removeWithTransition;
      op(this.$el, this, realCb);
    }
    return this;
  };

  /**
   * Shared DOM insertion function.
   *
   * @param {Vue} vm
   * @param {Element} target
   * @param {Function} [cb]
   * @param {Boolean} [withTransition]
   * @param {Function} op1 - op for non-transition insert
   * @param {Function} op2 - op for transition insert
   * @return vm
   */

  function insert(vm, target, cb, withTransition, op1, op2) {
    target = query(target);
    var targetIsDetached = !inDoc(target);
    var op = withTransition === false || targetIsDetached ? op1 : op2;
    var shouldCallHook = !targetIsDetached && !vm._isAttached && !inDoc(vm.$el);
    if (vm._isFragment) {
      mapNodeRange(vm._fragmentStart, vm._fragmentEnd, function (node) {
        op(node, target, vm);
      });
      cb && cb();
    } else {
      op(vm.$el, target, vm, cb);
    }
    if (shouldCallHook) {
      vm._callHook('attached');
    }
    return vm;
  }

  /**
   * Check for selectors
   *
   * @param {String|Element} el
   */

  function query(el) {
    return typeof el === 'string' ? document.querySelector(el) : el;
  }

  /**
   * Append operation that takes a callback.
   *
   * @param {Node} el
   * @param {Node} target
   * @param {Vue} vm - unused
   * @param {Function} [cb]
   */

  function append(el, target, vm, cb) {
    target.appendChild(el);
    if (cb) cb();
  }

  /**
   * InsertBefore operation that takes a callback.
   *
   * @param {Node} el
   * @param {Node} target
   * @param {Vue} vm - unused
   * @param {Function} [cb]
   */

  function beforeWithCb(el, target, vm, cb) {
    before(el, target);
    if (cb) cb();
  }

  /**
   * Remove operation that takes a callback.
   *
   * @param {Node} el
   * @param {Vue} vm - unused
   * @param {Function} [cb]
   */

  function removeWithCb(el, vm, cb) {
    remove(el);
    if (cb) cb();
  }
}

function eventsAPI (Vue) {

  /**
   * Listen on the given `event` with `fn`.
   *
   * @param {String} event
   * @param {Function} fn
   */

  Vue.prototype.$on = function (event, fn) {
    (this._events[event] || (this._events[event] = [])).push(fn);
    modifyListenerCount(this, event, 1);
    return this;
  };

  /**
   * Adds an `event` listener that will be invoked a single
   * time then automatically removed.
   *
   * @param {String} event
   * @param {Function} fn
   */

  Vue.prototype.$once = function (event, fn) {
    var self = this;
    function on() {
      self.$off(event, on);
      fn.apply(this, arguments);
    }
    on.fn = fn;
    this.$on(event, on);
    return this;
  };

  /**
   * Remove the given callback for `event` or all
   * registered callbacks.
   *
   * @param {String} event
   * @param {Function} fn
   */

  Vue.prototype.$off = function (event, fn) {
    var cbs;
    // all
    if (!arguments.length) {
      if (this.$parent) {
        for (event in this._events) {
          cbs = this._events[event];
          if (cbs) {
            modifyListenerCount(this, event, -cbs.length);
          }
        }
      }
      this._events = {};
      return this;
    }
    // specific event
    cbs = this._events[event];
    if (!cbs) {
      return this;
    }
    if (arguments.length === 1) {
      modifyListenerCount(this, event, -cbs.length);
      this._events[event] = null;
      return this;
    }
    // specific handler
    var cb;
    var i = cbs.length;
    while (i--) {
      cb = cbs[i];
      if (cb === fn || cb.fn === fn) {
        modifyListenerCount(this, event, -1);
        cbs.splice(i, 1);
        break;
      }
    }
    return this;
  };

  /**
   * Trigger an event on self.
   *
   * @param {String} event
   * @return {Boolean} shouldPropagate
   */

  Vue.prototype.$emit = function (event) {
    var cbs = this._events[event];
    var shouldPropagate = !cbs;
    if (cbs) {
      cbs = cbs.length > 1 ? toArray(cbs) : cbs;
      var args = toArray(arguments, 1);
      for (var i = 0, l = cbs.length; i < l; i++) {
        var res = cbs[i].apply(this, args);
        if (res === true) {
          shouldPropagate = true;
        }
      }
    }
    return shouldPropagate;
  };

  /**
   * Recursively broadcast an event to all children instances.
   *
   * @param {String} event
   * @param {...*} additional arguments
   */

  Vue.prototype.$broadcast = function (event) {
    // if no child has registered for this event,
    // then there's no need to broadcast.
    if (!this._eventsCount[event]) return;
    var children = this.$children;
    for (var i = 0, l = children.length; i < l; i++) {
      var child = children[i];
      var shouldPropagate = child.$emit.apply(child, arguments);
      if (shouldPropagate) {
        child.$broadcast.apply(child, arguments);
      }
    }
    return this;
  };

  /**
   * Recursively propagate an event up the parent chain.
   *
   * @param {String} event
   * @param {...*} additional arguments
   */

  Vue.prototype.$dispatch = function () {
    this.$emit.apply(this, arguments);
    var parent = this.$parent;
    while (parent) {
      var shouldPropagate = parent.$emit.apply(parent, arguments);
      parent = shouldPropagate ? parent.$parent : null;
    }
    return this;
  };

  /**
   * Modify the listener counts on all parents.
   * This bookkeeping allows $broadcast to return early when
   * no child has listened to a certain event.
   *
   * @param {Vue} vm
   * @param {String} event
   * @param {Number} count
   */

  var hookRE = /^hook:/;
  function modifyListenerCount(vm, event, count) {
    var parent = vm.$parent;
    // hooks do not get broadcasted so no need
    // to do bookkeeping for them
    if (!parent || !count || hookRE.test(event)) return;
    while (parent) {
      parent._eventsCount[event] = (parent._eventsCount[event] || 0) + count;
      parent = parent.$parent;
    }
  }
}

function lifecycleAPI (Vue) {

  /**
   * Set instance target element and kick off the compilation
   * process. The passed in `el` can be a selector string, an
   * existing Element, or a DocumentFragment (for block
   * instances).
   *
   * @param {Element|DocumentFragment|string} el
   * @public
   */

  Vue.prototype.$mount = function (el) {
    if (this._isCompiled) {
      process.env.NODE_ENV !== 'production' && warn('$mount() should be called only once.');
      return;
    }
    el = query(el);
    if (!el) {
      el = document.createElement('div');
    }
    this._compile(el);
    this._initDOMHooks();
    if (inDoc(this.$el)) {
      this._callHook('attached');
      ready.call(this);
    } else {
      this.$once('hook:attached', ready);
    }
    return this;
  };

  /**
   * Mark an instance as ready.
   */

  function ready() {
    this._isAttached = true;
    this._isReady = true;
    this._callHook('ready');
  }

  /**
   * Teardown the instance, simply delegate to the internal
   * _destroy.
   */

  Vue.prototype.$destroy = function (remove, deferCleanup) {
    this._destroy(remove, deferCleanup);
  };

  /**
   * Partially compile a piece of DOM and return a
   * decompile function.
   *
   * @param {Element|DocumentFragment} el
   * @param {Vue} [host]
   * @return {Function}
   */

  Vue.prototype.$compile = function (el, host, scope, frag) {
    return compile(el, this.$options, true)(this, el, host, scope, frag);
  };
}

/**
 * The exposed Vue constructor.
 *
 * API conventions:
 * - public API methods/properties are prefixed with `$`
 * - internal methods/properties are prefixed with `_`
 * - non-prefixed properties are assumed to be proxied user
 *   data.
 *
 * @constructor
 * @param {Object} [options]
 * @public
 */

function Vue(options) {
  this._init(options);
}

// install internals
initMixin(Vue);
stateMixin(Vue);
eventsMixin(Vue);
lifecycleMixin(Vue);
miscMixin(Vue);

// install APIs
globalAPI(Vue);
dataAPI(Vue);
domAPI(Vue);
eventsAPI(Vue);
lifecycleAPI(Vue);

var convertArray = vFor._postProcess;

/**
 * Limit filter for arrays
 *
 * @param {Number} n
 * @param {Number} offset (Decimal expected)
 */

function limitBy(arr, n, offset) {
  offset = offset ? parseInt(offset, 10) : 0;
  return typeof n === 'number' ? arr.slice(offset, offset + n) : arr;
}

/**
 * Filter filter for arrays
 *
 * @param {String} search
 * @param {String} [delimiter]
 * @param {String} ...dataKeys
 */

function filterBy(arr, search, delimiter) {
  arr = convertArray(arr);
  if (search == null) {
    return arr;
  }
  if (typeof search === 'function') {
    return arr.filter(search);
  }
  // cast to lowercase string
  search = ('' + search).toLowerCase();
  // allow optional `in` delimiter
  // because why not
  var n = delimiter === 'in' ? 3 : 2;
  // extract and flatten keys
  var keys = toArray(arguments, n).reduce(function (prev, cur) {
    return prev.concat(cur);
  }, []);
  var res = [];
  var item, key, val, j;
  for (var i = 0, l = arr.length; i < l; i++) {
    item = arr[i];
    val = item && item.$value || item;
    j = keys.length;
    if (j) {
      while (j--) {
        key = keys[j];
        if (key === '$key' && contains(item.$key, search) || contains(getPath(val, key), search)) {
          res.push(item);
          break;
        }
      }
    } else if (contains(item, search)) {
      res.push(item);
    }
  }
  return res;
}

/**
 * Filter filter for arrays
 *
 * @param {String} sortKey
 * @param {String} reverse
 */

function orderBy(arr, sortKey, reverse) {
  arr = convertArray(arr);
  if (!sortKey) {
    return arr;
  }
  var order = reverse && reverse < 0 ? -1 : 1;
  // sort on a copy to avoid mutating original array
  return arr.slice().sort(function (a, b) {
    if (sortKey !== '$key') {
      if (isObject(a) && '$value' in a) a = a.$value;
      if (isObject(b) && '$value' in b) b = b.$value;
    }
    a = isObject(a) ? getPath(a, sortKey) : a;
    b = isObject(b) ? getPath(b, sortKey) : b;
    return a === b ? 0 : a > b ? order : -order;
  });
}

/**
 * String contain helper
 *
 * @param {*} val
 * @param {String} search
 */

function contains(val, search) {
  var i;
  if (isPlainObject(val)) {
    var keys = Object.keys(val);
    i = keys.length;
    while (i--) {
      if (contains(val[keys[i]], search)) {
        return true;
      }
    }
  } else if (isArray(val)) {
    i = val.length;
    while (i--) {
      if (contains(val[i], search)) {
        return true;
      }
    }
  } else if (val != null) {
    return val.toString().toLowerCase().indexOf(search) > -1;
  }
}

var digitsRE = /(\d{3})(?=\d)/g;

// asset collections must be a plain object.
var filters = {

  orderBy: orderBy,
  filterBy: filterBy,
  limitBy: limitBy,

  /**
   * Stringify value.
   *
   * @param {Number} indent
   */

  json: {
    read: function read(value, indent) {
      return typeof value === 'string' ? value : JSON.stringify(value, null, Number(indent) || 2);
    },
    write: function write(value) {
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    }
  },

  /**
   * 'abc' => 'Abc'
   */

  capitalize: function capitalize(value) {
    if (!value && value !== 0) return '';
    value = value.toString();
    return value.charAt(0).toUpperCase() + value.slice(1);
  },

  /**
   * 'abc' => 'ABC'
   */

  uppercase: function uppercase(value) {
    return value || value === 0 ? value.toString().toUpperCase() : '';
  },

  /**
   * 'AbC' => 'abc'
   */

  lowercase: function lowercase(value) {
    return value || value === 0 ? value.toString().toLowerCase() : '';
  },

  /**
   * 12345 => $12,345.00
   *
   * @param {String} sign
   */

  currency: function currency(value, _currency) {
    value = parseFloat(value);
    if (!isFinite(value) || !value && value !== 0) return '';
    _currency = _currency != null ? _currency : '$';
    var stringified = Math.abs(value).toFixed(2);
    var _int = stringified.slice(0, -3);
    var i = _int.length % 3;
    var head = i > 0 ? _int.slice(0, i) + (_int.length > 3 ? ',' : '') : '';
    var _float = stringified.slice(-3);
    var sign = value < 0 ? '-' : '';
    return _currency + sign + head + _int.slice(i).replace(digitsRE, '$1,') + _float;
  },

  /**
   * 'item' => 'items'
   *
   * @params
   *  an array of strings corresponding to
   *  the single, double, triple ... forms of the word to
   *  be pluralized. When the number to be pluralized
   *  exceeds the length of the args, it will use the last
   *  entry in the array.
   *
   *  e.g. ['single', 'double', 'triple', 'multiple']
   */

  pluralize: function pluralize(value) {
    var args = toArray(arguments, 1);
    return args.length > 1 ? args[value % 10 - 1] || args[args.length - 1] : args[0] + (value === 1 ? '' : 's');
  },

  /**
   * Debounce a handler function.
   *
   * @param {Function} handler
   * @param {Number} delay = 300
   * @return {Function}
   */

  debounce: function debounce(handler, delay) {
    if (!handler) return;
    if (!delay) {
      delay = 300;
    }
    return _debounce(handler, delay);
  }
};

var partial = {

  priority: PARTIAL,

  params: ['name'],

  // watch changes to name for dynamic partials
  paramWatchers: {
    name: function name(value) {
      vIf.remove.call(this);
      if (value) {
        this.insert(value);
      }
    }
  },

  bind: function bind() {
    this.anchor = createAnchor('v-partial');
    replace(this.el, this.anchor);
    this.insert(this.params.name);
  },

  insert: function insert(id) {
    var partial = resolveAsset(this.vm.$options, 'partials', id);
    if (process.env.NODE_ENV !== 'production') {
      assertAsset(partial, 'partial', id);
    }
    if (partial) {
      this.factory = new FragmentFactory(this.vm, partial);
      vIf.insert.call(this);
    }
  },

  unbind: function unbind() {
    if (this.frag) {
      this.frag.destroy();
    }
  }
};

// This is the elementDirective that handles <content>
// transclusions. It relies on the raw content of an
// instance being stored as `$options._content` during
// the transclude phase.

// We are exporting two versions, one for named and one
// for unnamed, because the unnamed slots must be compiled
// AFTER all named slots have selected their content. So
// we need to give them different priorities in the compilation
// process. (See #1965)

var slot = {

  priority: SLOT,

  bind: function bind() {
    var host = this.vm;
    var raw = host.$options._content;
    if (!raw) {
      this.fallback();
      return;
    }
    var context = host._context;
    var slotName = this.params && this.params.name;
    if (!slotName) {
      // Default slot
      this.tryCompile(extractFragment(raw.childNodes, raw, true), context, host);
    } else {
      // Named slot
      var selector = '[slot="' + slotName + '"]';
      var nodes = raw.querySelectorAll(selector);
      if (nodes.length) {
        this.tryCompile(extractFragment(nodes, raw), context, host);
      } else {
        this.fallback();
      }
    }
  },

  tryCompile: function tryCompile(content, context, host) {
    if (content.hasChildNodes()) {
      this.compile(content, context, host);
    } else {
      this.fallback();
    }
  },

  compile: function compile(content, context, host) {
    if (content && context) {
      var scope = host ? host._scope : this._scope;
      this.unlink = context.$compile(content, host, scope, this._frag);
    }
    if (content) {
      replace(this.el, content);
    } else {
      remove(this.el);
    }
  },

  fallback: function fallback() {
    this.compile(extractContent(this.el, true), this.vm);
  },

  unbind: function unbind() {
    if (this.unlink) {
      this.unlink();
    }
  }
};

var namedSlot = extend(extend({}, slot), {
  priority: slot.priority + 1,
  params: ['name']
});

/**
 * Extract qualified content nodes from a node list.
 *
 * @param {NodeList} nodes
 * @param {Element} parent
 * @param {Boolean} main
 * @return {DocumentFragment}
 */

function extractFragment(nodes, parent, main) {
  var frag = document.createDocumentFragment();
  for (var i = 0, l = nodes.length; i < l; i++) {
    var node = nodes[i];
    // if this is the main outlet, we want to skip all
    // previously selected nodes;
    // otherwise, we want to mark the node as selected.
    // clone the node so the original raw content remains
    // intact. this ensures proper re-compilation in cases
    // where the outlet is inside a conditional block
    if (main && !node.__v_selected) {
      append(node);
    } else if (!main && node.parentNode === parent) {
      node.__v_selected = true;
      append(node);
    }
  }
  return frag;

  function append(node) {
    if (isTemplate(node) && !node.hasAttribute('v-if') && !node.hasAttribute('v-for')) {
      node = parseTemplate(node);
    }
    node = cloneNode(node);
    frag.appendChild(node);
  }
}

var elementDirectives = {
  slot: slot,
  _namedSlot: namedSlot, // same as slot but with higher priority
  partial: partial
};

Vue.version = '1.0.13';

/**
 * Vue and every constructor that extends Vue has an
 * associated options object, which can be accessed during
 * compilation steps as `this.constructor.options`.
 *
 * These can be seen as the default options of every
 * Vue instance.
 */

Vue.options = {
  directives: publicDirectives,
  elementDirectives: elementDirectives,
  filters: filters,
  transitions: {},
  components: {},
  partials: {},
  replace: true
};

// devtools global hook
/* istanbul ignore if */
if (process.env.NODE_ENV !== 'production' && inBrowser) {
  if (window.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
    window.__VUE_DEVTOOLS_GLOBAL_HOOK__.emit('init', Vue);
  } else if (/Chrome\/\d+/.test(navigator.userAgent)) {
    console.log('Download the Vue Devtools for a better development experience:\n' + 'https://github.com/vuejs/vue-devtools');
  }
}

module.exports = Vue;
}).call(this,require('_process'))

},{"_process":1}],22:[function(require,module,exports){
'use strict';
/**
*Module dependencies
*/
var Vue = require('vue');
//==============================================================================
/**
*Module config
*/
Vue.use(require('vue-resource'));
Vue.http.options.root = '/root';
Vue.http.headers.common['Authorization'] = 'Basic YXBpOnBhc3N3b3Jk';
//==============================================================================
/**
*Create components
*/
//==============================================================================
var
  appGlobals = {
    person: window.appUserData.person,
    currentProfile: window.appUserData.currentProfile,
    facebook: {
      name: window.appUserData.fbName,
      email: window.appUserData.fbEmail
    },
    twitter: {
      handle: window.appUserData.twitterHandle,
      location: window.appUserData.twitterLocation,
      description: window.appUserData.twitterDescription
    },
    local: {
      username: window.appUserData.localUser,
      email: window.appUserData.localEmail
    },
    userPhoto: window.appUserData.userPhoto,
    fbURL: '/facebook',
    twitterURL: '/twitter/statuses/home_timeline',
    linkStatus: {
      local: window.appUserData.localLinkStatus,
      fb: window.appUserData.fbLinkStatus,
      twitter: window.appUserData.twitterLinkStatus
    },
    hideLinkAcct: window.appUserData.hideLinkAcct,
    hideLocalLink: window.appUserData.hideLocalLink,
    hideFBLink: window.appUserData.hideFBLink,
    hideTwitterLink: window.appUserData.hideTwitterLink
  },
  appNav = require('./components/nav'),
  appProfile = require('./components/profile')(appGlobals),
  appLocal = require('./components/local')(appGlobals),
  appFacebook = require('./components/facebook')(appGlobals),
  appTwitter = require('./components/twitter')(appGlobals);
/**
*Create base VM
*/
var vm = new Vue({
  el: '#app',
  data: {
    currentPage: 'app-profile'
  },
  computed: {},
  methods: {},
  events: {
    'setpage': function (page) {
      if(page == 'profile') {
        this.currentPage = 'app-profile';
        return null;
      }
      if(page == 'local') {
        this.currentPage = 'app-local';
        return null;
      }
      if(page == 'facebook') {
        this.currentPage = 'app-facebook';
        return null;
      }
      if(page == 'twitter') {
        this.currentPage = 'app-twitter';
        return null;
      }
    }
  },
  components: {
    'app-nav': appNav,
    'app-profile': appProfile,
    'app-local': appLocal,
    'app-facebook': appFacebook,
    'app-twitter': appTwitter
  }
});

},{"./components/facebook":23,"./components/local":25,"./components/nav":27,"./components/profile":29,"./components/twitter":31,"vue":21,"vue-resource":6}],23:[function(require,module,exports){
module.exports = function (appGlobals) {
  return {
    template: require('./template.html'),
    data: function () {
      return {
        details: {
          name: appGlobals.facebook.name,
          email: appGlobals.facebook.email
        },
        posts: [],
        showLoading: false
      };
    },
    computed: {
      showPosts: function () {
        if(this.posts.length) {
          return true;
        }
        return false;
      },
      showBlock: function () {
        if(this.details.name.length) {
          return true;
        }
        return false;
      }
    },
    methods: {
      getPosts: function () {
        this.showLoading = true;
        this.$http.get(appGlobals.fbURL)
        .then(function (res) {
          this.showLoading = false;
          res.data.data.forEach(function (post) {
            this.posts.push(post);
          }.bind(this))
        })
        .catch(function (info, status, req) {
          this.showLoading = false;
          this.posts.push(status);
        }.bind(this));
      }
    }
  };
};

},{"./template.html":24}],24:[function(require,module,exports){
module.exports = '<div>\n  <h3>Profile Name: Facebook</h3>\n  <template v-if="showBlock">\n    <p>Details</p>\n    <ul>\n      <li v-for="value in details">{{$key}}: {{{value}}}</li>\n    </ul>\n    <div>\n      <button @click.prevent.stop="getPosts"\n      class="btn btn-primary btn-large">Get Recent Posts</button>\n      <span v-show="showLoading">Loading...</span>\n      <ul v-show="showPosts" class="list-group">\n        <li v-for="item in posts" class="list-group-item">\n          <div class="well">\n            <p v-show="item.message.length">Message: {{item.message}}</p>\n            <p v-show="item.story.length">Story: {{item.story}}</p>\n          </div>\n        </li>\n      </ul>\n    </div>\n  </template>\n</div>\n';
},{}],25:[function(require,module,exports){
module.exports = function (appGlobals) {
  return {
    template: require('./template.html'),
    data: function () {
      return {
        details: {
          username: appGlobals.local.username,
          email: appGlobals.local.email
        }
      };
    },
    computed: {
      showBlock: function () {
        if(this.details.username.length) {
          return true;
        }
        return false;
      }
    }
  };
};

},{"./template.html":26}],26:[function(require,module,exports){
module.exports = '<div>\n  <h3>Profile Name: Local</h3>\n  <template v-if="showBlock">\n    <p>Details</p>\n    <ul>\n      <li v-for="value in details">{{$key}}: {{value}}</li>\n    </ul>\n  </template>\n</div>\n';
},{}],27:[function(require,module,exports){
module.exports = {
  template: require('./template.html'),
  methods: {
    changePage: function (page) {
      this.$dispatch('setpage', page);
      return null;
    }
  }
};

},{"./template.html":28}],28:[function(require,module,exports){
module.exports = '<ul class="nav navbar-nav">\n  <li><a href="" @click.prevent.stop="changePage(\'profile\')">Profile</a></li>\n  <li><a href="" @click.prevent.stop="changePage(\'local\')">Local</a></li>\n  <li><a href="" @click.prevent.stop="changePage(\'facebook\')">Facebook</a></li>\n  <li><a href="" @click.prevent.stop="changePage(\'twitter\')">Twitter</a></li>\n</ul>\n';
},{}],29:[function(require,module,exports){
module.exports = function (appGlobals) {
  return {
    template: require('./template.html'),
    data: function () {
      return {
        person: appGlobals.person,
        currentProfile: appGlobals.currentProfile,
        userPhoto: appGlobals.userPhoto,
        localLinkStatus: appGlobals.linkStatus.local,
        fbLinkStatus: appGlobals.linkStatus.fb,
        twitterLinkStatus: appGlobals.linkStatus.twitter,
        hideLinkAcct: appGlobals.hideLinkAcct,
        hideLocalLink: appGlobals.hideLocalLink,
        hideFBLink: appGlobals.hideFBLink,
        hideTwitterLink: appGlobals.hideTwitterLink
      };
    }
  };
};

},{"./template.html":30}],30:[function(require,module,exports){
module.exports = '<div>\n  <figure v-show="userPhoto"><img :src="userPhoto" :alt="person + \' photo\'"></figure>\n  <div>\n    <h3>Welcome \'{{{person}}}\', your present profile is \'{{currentProfile}}\'</h3>\n  </div>\n  <div>\n    <h3 v-show="hideLinkAcct">Link your other accounts to your profile</h3>\n    <p v-show="hideLocalLink"><a href="/connect/local">Local: Status ({{localLinkStatus}})</a></p>\n    <p v-show="hideFBLink"><a href="/connect/facebook">Facebook: Status ({{fbLinkStatus}})</a></p>\n    <p v-show="hideTwitterLink"><a href="/connect/twitter">Twitter: Status ({{twitterLinkStatus}})</a></p>\n  </div>\n</div>\n';
},{}],31:[function(require,module,exports){
module.exports = function (appGlobals) {
  return {
    template: require('./template.html'),
    data: function () {
      return {
        details: {
          handle: appGlobals.twitter.handle,
          location: appGlobals.twitter.location,
          description: appGlobals.twitter.description
        },
        timeline: [],
        showLoading: false
      };
    },
    computed: {
      showTimeLine: function () {
        if(this.timeline.length) {
          return true;
        }
        return false;
      },
      showBlock: function () {
        if(this.details.handle.length) {
          return true;
        }
        return false;
      }
    },
    methods: {
      getTweets: function () {
        this.showLoading = true;
        this.$http.get(appGlobals.twitterURL)
        .then(function (res) {
          this.showLoading = false;
          res.data.msg.forEach(function (tweet) {
            this.timeline.push(tweet);
          }.bind(this))
        })
        .catch(function (info, status, req) {
          this.showLoading = false;
          this.posts.push(status);
        }.bind(this));
      }
    }
  };
};

},{"./template.html":32}],32:[function(require,module,exports){
module.exports = '<div>\n  <h3>Profile Name: Twitter</h3>\n  <template v-if="showBlock">\n    <p>Details</p>\n    <ul>\n      <li v-for="value in details">{{$key}}: {{value}}</li>\n    </ul>\n    <div>\n      <button @click.prevent.stop="getTweets"\n      class="btn btn-primary btn-large">Get Recent timeline activity</button>\n      <span v-show="showLoading">Loading...</span>\n      <ul v-show="showTimeLine" class="list-group">\n        <li v-for="item in timeline" class="list-group-item">\n          <div class="well">\n            <figure><img :src="item.photo" alt="{{item.sender}} photo" /></figure>\n            <p>Sender: {{item.sender}}</p>\n            <p>Location: {{item.location}}</p>\n            <p>Tweet: {{item.text}}</p>\n          </div>\n        </li>\n      </ul>\n    </div>\n  </template>\n</div>\n';
},{}]},{},[22])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS1yZXNvdXJjZS9zcmMvY2xpZW50L2RlZmF1bHQuanMiLCJub2RlX21vZHVsZXMvdnVlLXJlc291cmNlL3NyYy9jbGllbnQvanNvbnAuanMiLCJub2RlX21vZHVsZXMvdnVlLXJlc291cmNlL3NyYy9jbGllbnQveGhyLmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS1yZXNvdXJjZS9zcmMvaHR0cC5qcyIsIm5vZGVfbW9kdWxlcy92dWUtcmVzb3VyY2Uvc3JjL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS1yZXNvdXJjZS9zcmMvaW50ZXJjZXB0b3IvYmVmb3JlLmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS1yZXNvdXJjZS9zcmMvaW50ZXJjZXB0b3IvY29ycy5qcyIsIm5vZGVfbW9kdWxlcy92dWUtcmVzb3VyY2Uvc3JjL2ludGVyY2VwdG9yL2hlYWRlci5qcyIsIm5vZGVfbW9kdWxlcy92dWUtcmVzb3VyY2Uvc3JjL2ludGVyY2VwdG9yL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS1yZXNvdXJjZS9zcmMvaW50ZXJjZXB0b3IvanNvbnAuanMiLCJub2RlX21vZHVsZXMvdnVlLXJlc291cmNlL3NyYy9pbnRlcmNlcHRvci9tZXRob2QuanMiLCJub2RlX21vZHVsZXMvdnVlLXJlc291cmNlL3NyYy9pbnRlcmNlcHRvci9taW1lLmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS1yZXNvdXJjZS9zcmMvaW50ZXJjZXB0b3IvdGltZW91dC5qcyIsIm5vZGVfbW9kdWxlcy92dWUtcmVzb3VyY2Uvc3JjL2xpYi9wcm9taXNlLmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS1yZXNvdXJjZS9zcmMvbGliL3VybC10ZW1wbGF0ZS5qcyIsIm5vZGVfbW9kdWxlcy92dWUtcmVzb3VyY2Uvc3JjL2xpYi91dGlsLmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS1yZXNvdXJjZS9zcmMvcHJvbWlzZS5qcyIsIm5vZGVfbW9kdWxlcy92dWUtcmVzb3VyY2Uvc3JjL3Jlc291cmNlLmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS1yZXNvdXJjZS9zcmMvdXJsLmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS9kaXN0L3Z1ZS5jb21tb24uanMiLCJwdWJsaWMvanMvYXBwLmpzIiwicHVibGljL2pzL2NvbXBvbmVudHMvZmFjZWJvb2svaW5kZXguanMiLCJwdWJsaWMvanMvY29tcG9uZW50cy9mYWNlYm9vay90ZW1wbGF0ZS5odG1sIiwicHVibGljL2pzL2NvbXBvbmVudHMvbG9jYWwvaW5kZXguanMiLCJwdWJsaWMvanMvY29tcG9uZW50cy9sb2NhbC90ZW1wbGF0ZS5odG1sIiwicHVibGljL2pzL2NvbXBvbmVudHMvbmF2L2luZGV4LmpzIiwicHVibGljL2pzL2NvbXBvbmVudHMvbmF2L3RlbXBsYXRlLmh0bWwiLCJwdWJsaWMvanMvY29tcG9uZW50cy9wcm9maWxlL2luZGV4LmpzIiwicHVibGljL2pzL2NvbXBvbmVudHMvcHJvZmlsZS90ZW1wbGF0ZS5odG1sIiwicHVibGljL2pzL2NvbXBvbmVudHMvdHdpdHRlci9pbmRleC5qcyIsInB1YmxpYy9qcy9jb21wb25lbnRzL3R3aXR0ZXIvdGVtcGxhdGUuaHRtbCJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9HQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDbktBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNudFNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1RBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkJBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBzZXRUaW1lb3V0KGRyYWluUXVldWUsIDApO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwiLyoqXG4gKiBEZWZhdWx0IGNsaWVudC5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChfKSB7XG5cbiAgICB2YXIgeGhyQ2xpZW50ID0gcmVxdWlyZSgnLi94aHInKShfKTtcblxuICAgIHJldHVybiBmdW5jdGlvbiAocmVxdWVzdCkge1xuICAgICAgICByZXR1cm4gKHJlcXVlc3QuY2xpZW50IHx8IHhockNsaWVudCkocmVxdWVzdCk7XG4gICAgfTtcblxufTtcbiIsIi8qKlxuICogSlNPTlAgY2xpZW50LlxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKF8pIHtcblxuICAgIHZhciBQcm9taXNlID0gcmVxdWlyZSgnLi4vcHJvbWlzZScpKF8pO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uIChyZXF1ZXN0KSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSkge1xuXG4gICAgICAgICAgICB2YXIgY2FsbGJhY2sgPSAnX2pzb25wJyArIE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cigyKSwgcmVzcG9uc2UgPSB7cmVxdWVzdDogcmVxdWVzdCwgZGF0YTogbnVsbH0sIGhhbmRsZXIsIHNjcmlwdDtcblxuICAgICAgICAgICAgcmVxdWVzdC5wYXJhbXNbcmVxdWVzdC5qc29ucF0gPSBjYWxsYmFjaztcbiAgICAgICAgICAgIHJlcXVlc3QuY2FuY2VsID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGhhbmRsZXIoe3R5cGU6ICdjYW5jZWwnfSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBzY3JpcHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcbiAgICAgICAgICAgIHNjcmlwdC5zcmMgPSBfLnVybChyZXF1ZXN0KTtcbiAgICAgICAgICAgIHNjcmlwdC50eXBlID0gJ3RleHQvamF2YXNjcmlwdCc7XG4gICAgICAgICAgICBzY3JpcHQuYXN5bmMgPSB0cnVlO1xuXG4gICAgICAgICAgICB3aW5kb3dbY2FsbGJhY2tdID0gZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAgICAgICByZXNwb25zZS5kYXRhID0gZGF0YTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGhhbmRsZXIgPSBmdW5jdGlvbiAoZXZlbnQpIHtcblxuICAgICAgICAgICAgICAgIGlmIChldmVudC50eXBlID09PSAnbG9hZCcgJiYgcmVzcG9uc2UuZGF0YSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICByZXNwb25zZS5zdGF0dXMgPSAyMDA7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChldmVudC50eXBlID09PSAnZXJyb3InKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlLnN0YXR1cyA9IDQwNDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXNwb25zZS5zdGF0dXMgPSAwO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJlc29sdmUocmVzcG9uc2UpO1xuXG4gICAgICAgICAgICAgICAgZGVsZXRlIHdpbmRvd1tjYWxsYmFja107XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChzY3JpcHQpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgc2NyaXB0Lm9ubG9hZCA9IGhhbmRsZXI7XG4gICAgICAgICAgICBzY3JpcHQub25lcnJvciA9IGhhbmRsZXI7XG5cbiAgICAgICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoc2NyaXB0KTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxufTtcbiIsIi8qKlxuICogWE1MSHR0cCBjbGllbnQuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoXykge1xuXG4gICAgdmFyIFByb21pc2UgPSByZXF1aXJlKCcuLi9wcm9taXNlJykoXyk7XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gKHJlcXVlc3QpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlKSB7XG5cbiAgICAgICAgICAgIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKSwgcmVzcG9uc2UgPSB7cmVxdWVzdDogcmVxdWVzdH0sIGhhbmRsZXI7XG5cbiAgICAgICAgICAgIHJlcXVlc3QuY2FuY2VsID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHhoci5hYm9ydCgpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgeGhyLm9wZW4ocmVxdWVzdC5tZXRob2QsIF8udXJsKHJlcXVlc3QpLCB0cnVlKTtcblxuICAgICAgICAgICAgaWYgKF8uaXNQbGFpbk9iamVjdChyZXF1ZXN0LnhocikpIHtcbiAgICAgICAgICAgICAgICBfLmV4dGVuZCh4aHIsIHJlcXVlc3QueGhyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgXy5lYWNoKHJlcXVlc3QuaGVhZGVycyB8fCB7fSwgZnVuY3Rpb24gKHZhbHVlLCBoZWFkZXIpIHtcbiAgICAgICAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihoZWFkZXIsIHZhbHVlKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBoYW5kbGVyID0gZnVuY3Rpb24gKGV2ZW50KSB7XG5cbiAgICAgICAgICAgICAgICByZXNwb25zZS5kYXRhID0geGhyLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICAgICAgICByZXNwb25zZS5zdGF0dXMgPSB4aHIuc3RhdHVzO1xuICAgICAgICAgICAgICAgIHJlc3BvbnNlLnN0YXR1c1RleHQgPSB4aHIuc3RhdHVzVGV4dDtcbiAgICAgICAgICAgICAgICByZXNwb25zZS5oZWFkZXJzID0gZ2V0SGVhZGVycyh4aHIpO1xuXG4gICAgICAgICAgICAgICAgcmVzb2x2ZShyZXNwb25zZSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICB4aHIub25sb2FkID0gaGFuZGxlcjtcbiAgICAgICAgICAgIHhoci5vbmFib3J0ID0gaGFuZGxlcjtcbiAgICAgICAgICAgIHhoci5vbmVycm9yID0gaGFuZGxlcjtcblxuICAgICAgICAgICAgeGhyLnNlbmQocmVxdWVzdC5kYXRhKTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIGdldEhlYWRlcnMoeGhyKSB7XG5cbiAgICAgICAgdmFyIGhlYWRlcnM7XG5cbiAgICAgICAgaWYgKCFoZWFkZXJzKSB7XG4gICAgICAgICAgICBoZWFkZXJzID0gcGFyc2VIZWFkZXJzKHhoci5nZXRBbGxSZXNwb25zZUhlYWRlcnMoKSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKG5hbWUpIHtcblxuICAgICAgICAgICAgaWYgKG5hbWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaGVhZGVyc1tfLnRvTG93ZXIobmFtZSldO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gaGVhZGVycztcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwYXJzZUhlYWRlcnMoc3RyKSB7XG5cbiAgICAgICAgdmFyIGhlYWRlcnMgPSB7fSwgdmFsdWUsIG5hbWUsIGk7XG5cbiAgICAgICAgaWYgKF8uaXNTdHJpbmcoc3RyKSkge1xuICAgICAgICAgICAgXy5lYWNoKHN0ci5zcGxpdCgnXFxuJyksIGZ1bmN0aW9uIChyb3cpIHtcblxuICAgICAgICAgICAgICAgIGkgPSByb3cuaW5kZXhPZignOicpO1xuICAgICAgICAgICAgICAgIG5hbWUgPSBfLnRyaW0oXy50b0xvd2VyKHJvdy5zbGljZSgwLCBpKSkpO1xuICAgICAgICAgICAgICAgIHZhbHVlID0gXy50cmltKHJvdy5zbGljZShpICsgMSkpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGhlYWRlcnNbbmFtZV0pIHtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoXy5pc0FycmF5KGhlYWRlcnNbbmFtZV0pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJzW25hbWVdLnB1c2godmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgaGVhZGVyc1tuYW1lXSA9IFtoZWFkZXJzW25hbWVdLCB2YWx1ZV07XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgaGVhZGVyc1tuYW1lXSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gaGVhZGVycztcbiAgICB9XG5cbn07XG4iLCIvKipcbiAqIFNlcnZpY2UgZm9yIHNlbmRpbmcgbmV0d29yayByZXF1ZXN0cy5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChfKSB7XG5cbiAgICB2YXIgUHJvbWlzZSA9IHJlcXVpcmUoJy4vcHJvbWlzZScpKF8pO1xuICAgIHZhciBpbnRlcmNlcHRvciA9IHJlcXVpcmUoJy4vaW50ZXJjZXB0b3InKShfKTtcbiAgICB2YXIgZGVmYXVsdENsaWVudCA9IHJlcXVpcmUoJy4vY2xpZW50L2RlZmF1bHQnKShfKTtcbiAgICB2YXIganNvblR5cGUgPSB7J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ307XG5cbiAgICBmdW5jdGlvbiBIdHRwKHVybCwgb3B0aW9ucykge1xuXG4gICAgICAgIHZhciBjbGllbnQgPSBkZWZhdWx0Q2xpZW50LCByZXF1ZXN0LCBwcm9taXNlO1xuXG4gICAgICAgIGlmIChfLmlzUGxhaW5PYmplY3QodXJsKSkge1xuICAgICAgICAgICAgb3B0aW9ucyA9IHVybDtcbiAgICAgICAgICAgIHVybCA9ICcnO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVxdWVzdCA9IF8uZXh0ZW5kKHt1cmw6IHVybH0sIG9wdGlvbnMpO1xuICAgICAgICByZXF1ZXN0ID0gXy5leHRlbmQodHJ1ZSwge30sXG4gICAgICAgICAgICBIdHRwLm9wdGlvbnMsIHRoaXMub3B0aW9ucywgcmVxdWVzdFxuICAgICAgICApO1xuXG4gICAgICAgIEh0dHAuaW50ZXJjZXB0b3JzLmZvckVhY2goZnVuY3Rpb24gKGkpIHtcbiAgICAgICAgICAgIGNsaWVudCA9IGludGVyY2VwdG9yKGksIHRoaXMudm0pKGNsaWVudCk7XG4gICAgICAgIH0sIHRoaXMpO1xuXG4gICAgICAgIHByb21pc2UgPSBjbGllbnQocmVxdWVzdCkuYmluZCh0aGlzLnZtKS50aGVuKGZ1bmN0aW9uIChyZXNwb25zZSkge1xuXG4gICAgICAgICAgICByZXNwb25zZS5vayA9IHJlc3BvbnNlLnN0YXR1cyA+PSAyMDAgJiYgcmVzcG9uc2Uuc3RhdHVzIDwgMzAwO1xuICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLm9rID8gcmVzcG9uc2UgOiBQcm9taXNlLnJlamVjdChyZXNwb25zZSk7XG5cbiAgICAgICAgfSwgZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG5cbiAgICAgICAgICAgIGlmIChyZXNwb25zZSBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgICAgICAgICAgXy5lcnJvcihyZXNwb25zZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChyZXNwb25zZSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChyZXF1ZXN0LnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgIHByb21pc2Uuc3VjY2VzcyhyZXF1ZXN0LnN1Y2Nlc3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHJlcXVlc3QuZXJyb3IpIHtcbiAgICAgICAgICAgIHByb21pc2UuZXJyb3IocmVxdWVzdC5lcnJvcik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9XG5cbiAgICBIdHRwLm9wdGlvbnMgPSB7XG4gICAgICAgIG1ldGhvZDogJ2dldCcsXG4gICAgICAgIGRhdGE6ICcnLFxuICAgICAgICBwYXJhbXM6IHt9LFxuICAgICAgICBoZWFkZXJzOiB7fSxcbiAgICAgICAgeGhyOiBudWxsLFxuICAgICAgICBqc29ucDogJ2NhbGxiYWNrJyxcbiAgICAgICAgYmVmb3JlU2VuZDogbnVsbCxcbiAgICAgICAgY3Jvc3NPcmlnaW46IG51bGwsXG4gICAgICAgIGVtdWxhdGVIVFRQOiBmYWxzZSxcbiAgICAgICAgZW11bGF0ZUpTT046IGZhbHNlLFxuICAgICAgICB0aW1lb3V0OiAwXG4gICAgfTtcblxuICAgIEh0dHAuaW50ZXJjZXB0b3JzID0gW1xuICAgICAgICByZXF1aXJlKCcuL2ludGVyY2VwdG9yL2JlZm9yZScpKF8pLFxuICAgICAgICByZXF1aXJlKCcuL2ludGVyY2VwdG9yL3RpbWVvdXQnKShfKSxcbiAgICAgICAgcmVxdWlyZSgnLi9pbnRlcmNlcHRvci9qc29ucCcpKF8pLFxuICAgICAgICByZXF1aXJlKCcuL2ludGVyY2VwdG9yL21ldGhvZCcpKF8pLFxuICAgICAgICByZXF1aXJlKCcuL2ludGVyY2VwdG9yL21pbWUnKShfKSxcbiAgICAgICAgcmVxdWlyZSgnLi9pbnRlcmNlcHRvci9oZWFkZXInKShfKSxcbiAgICAgICAgcmVxdWlyZSgnLi9pbnRlcmNlcHRvci9jb3JzJykoXylcbiAgICBdO1xuXG4gICAgSHR0cC5oZWFkZXJzID0ge1xuICAgICAgICBwdXQ6IGpzb25UeXBlLFxuICAgICAgICBwb3N0OiBqc29uVHlwZSxcbiAgICAgICAgcGF0Y2g6IGpzb25UeXBlLFxuICAgICAgICBkZWxldGU6IGpzb25UeXBlLFxuICAgICAgICBjb21tb246IHsnQWNjZXB0JzogJ2FwcGxpY2F0aW9uL2pzb24sIHRleHQvcGxhaW4sICovKid9LFxuICAgICAgICBjdXN0b206IHsnWC1SZXF1ZXN0ZWQtV2l0aCc6ICdYTUxIdHRwUmVxdWVzdCd9XG4gICAgfTtcblxuICAgIFsnZ2V0JywgJ3B1dCcsICdwb3N0JywgJ3BhdGNoJywgJ2RlbGV0ZScsICdqc29ucCddLmZvckVhY2goZnVuY3Rpb24gKG1ldGhvZCkge1xuXG4gICAgICAgIEh0dHBbbWV0aG9kXSA9IGZ1bmN0aW9uICh1cmwsIGRhdGEsIHN1Y2Nlc3MsIG9wdGlvbnMpIHtcblxuICAgICAgICAgICAgaWYgKF8uaXNGdW5jdGlvbihkYXRhKSkge1xuICAgICAgICAgICAgICAgIG9wdGlvbnMgPSBzdWNjZXNzO1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPSBkYXRhO1xuICAgICAgICAgICAgICAgIGRhdGEgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChfLmlzT2JqZWN0KHN1Y2Nlc3MpKSB7XG4gICAgICAgICAgICAgICAgb3B0aW9ucyA9IHN1Y2Nlc3M7XG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHRoaXModXJsLCBfLmV4dGVuZCh7bWV0aG9kOiBtZXRob2QsIGRhdGE6IGRhdGEsIHN1Y2Nlc3M6IHN1Y2Nlc3N9LCBvcHRpb25zKSk7XG4gICAgICAgIH07XG4gICAgfSk7XG5cbiAgICByZXR1cm4gXy5odHRwID0gSHR0cDtcbn07XG4iLCIvKipcbiAqIEluc3RhbGwgcGx1Z2luLlxuICovXG5cbmZ1bmN0aW9uIGluc3RhbGwoVnVlKSB7XG5cbiAgICB2YXIgXyA9IHJlcXVpcmUoJy4vbGliL3V0aWwnKShWdWUpO1xuXG4gICAgVnVlLnVybCA9IHJlcXVpcmUoJy4vdXJsJykoXyk7XG4gICAgVnVlLmh0dHAgPSByZXF1aXJlKCcuL2h0dHAnKShfKTtcbiAgICBWdWUucmVzb3VyY2UgPSByZXF1aXJlKCcuL3Jlc291cmNlJykoXyk7XG4gICAgVnVlLnByb21pc2UgPSByZXF1aXJlKCcuL3Byb21pc2UnKShfKTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKFZ1ZS5wcm90b3R5cGUsIHtcblxuICAgICAgICAkdXJsOiB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gXy5vcHRpb25zKFZ1ZS51cmwsIHRoaXMsIHRoaXMuJG9wdGlvbnMudXJsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICAkaHR0cDoge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIF8ub3B0aW9ucyhWdWUuaHR0cCwgdGhpcywgdGhpcy4kb3B0aW9ucy5odHRwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICAkcmVzb3VyY2U6IHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBWdWUucmVzb3VyY2UuYmluZCh0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgfSk7XG59XG5cbmlmICh3aW5kb3cuVnVlKSB7XG4gICAgVnVlLnVzZShpbnN0YWxsKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpbnN0YWxsO1xuIiwiLyoqXG4gKiBCZWZvcmUgSW50ZXJjZXB0b3IuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoXykge1xuXG4gICAgcmV0dXJuIHtcblxuICAgICAgICByZXF1ZXN0OiBmdW5jdGlvbiAocmVxdWVzdCkge1xuXG4gICAgICAgICAgICBpZiAoXy5pc0Z1bmN0aW9uKHJlcXVlc3QuYmVmb3JlU2VuZCkpIHtcbiAgICAgICAgICAgICAgICByZXF1ZXN0LmJlZm9yZVNlbmQuY2FsbCh0aGlzLCByZXF1ZXN0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHJlcXVlc3Q7XG4gICAgICAgIH1cblxuICAgIH07XG5cbn07XG4iLCIvKipcbiAqIENPUlMgSW50ZXJjZXB0b3IuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoXykge1xuXG4gICAgdmFyIG9yaWdpblVybCA9IF8udXJsLnBhcnNlKGxvY2F0aW9uLmhyZWYpO1xuICAgIHZhciB4ZHJDbGllbnQgPSByZXF1aXJlKCcuLi9jbGllbnQvanNvbnAnKShfKTtcbiAgICB2YXIgeGhyQ29ycyA9ICd3aXRoQ3JlZGVudGlhbHMnIGluIG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgcmV0dXJuIHtcblxuICAgICAgICByZXF1ZXN0OiBmdW5jdGlvbiAocmVxdWVzdCkge1xuXG4gICAgICAgICAgICBpZiAocmVxdWVzdC5jcm9zc09yaWdpbiA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJlcXVlc3QuY3Jvc3NPcmlnaW4gPSBjcm9zc09yaWdpbihyZXF1ZXN0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHJlcXVlc3QuY3Jvc3NPcmlnaW4pIHtcblxuICAgICAgICAgICAgICAgIGlmICgheGhyQ29ycykge1xuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0LmNsaWVudCA9IHhkckNsaWVudDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXF1ZXN0LmVtdWxhdGVIVFRQID0gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiByZXF1ZXN0O1xuICAgICAgICB9XG5cbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gY3Jvc3NPcmlnaW4ocmVxdWVzdCkge1xuXG4gICAgICAgIHZhciByZXF1ZXN0VXJsID0gXy51cmwucGFyc2UoXy51cmwocmVxdWVzdCkpO1xuXG4gICAgICAgIHJldHVybiAocmVxdWVzdFVybC5wcm90b2NvbCAhPT0gb3JpZ2luVXJsLnByb3RvY29sIHx8IHJlcXVlc3RVcmwuaG9zdCAhPT0gb3JpZ2luVXJsLmhvc3QpO1xuICAgIH1cblxufTtcbiIsIi8qKlxuICogSGVhZGVyIEludGVyY2VwdG9yLlxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKF8pIHtcblxuICAgIHJldHVybiB7XG5cbiAgICAgICAgcmVxdWVzdDogZnVuY3Rpb24gKHJlcXVlc3QpIHtcblxuICAgICAgICAgICAgcmVxdWVzdC5tZXRob2QgPSByZXF1ZXN0Lm1ldGhvZC50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgcmVxdWVzdC5oZWFkZXJzID0gXy5leHRlbmQoe30sIF8uaHR0cC5oZWFkZXJzLmNvbW1vbixcbiAgICAgICAgICAgICAgICAhcmVxdWVzdC5jcm9zc09yaWdpbiA/IF8uaHR0cC5oZWFkZXJzLmN1c3RvbSA6IHt9LFxuICAgICAgICAgICAgICAgIF8uaHR0cC5oZWFkZXJzW3JlcXVlc3QubWV0aG9kLnRvTG93ZXJDYXNlKCldLFxuICAgICAgICAgICAgICAgIHJlcXVlc3QuaGVhZGVyc1xuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgaWYgKF8uaXNQbGFpbk9iamVjdChyZXF1ZXN0LmRhdGEpICYmIC9eKEdFVHxKU09OUCkkL2kudGVzdChyZXF1ZXN0Lm1ldGhvZCkpIHtcbiAgICAgICAgICAgICAgICBfLmV4dGVuZChyZXF1ZXN0LnBhcmFtcywgcmVxdWVzdC5kYXRhKTtcbiAgICAgICAgICAgICAgICBkZWxldGUgcmVxdWVzdC5kYXRhO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gcmVxdWVzdDtcbiAgICAgICAgfVxuXG4gICAgfTtcblxufTtcbiIsIi8qKlxuICogSW50ZXJjZXB0b3IgZmFjdG9yeS5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChfKSB7XG5cbiAgICB2YXIgUHJvbWlzZSA9IHJlcXVpcmUoJy4uL3Byb21pc2UnKShfKTtcblxuICAgIHJldHVybiBmdW5jdGlvbiAoaGFuZGxlciwgdm0pIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChjbGllbnQpIHtcblxuICAgICAgICAgICAgaWYgKF8uaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgICAgICAgICAgICAgIGhhbmRsZXIgPSBoYW5kbGVyLmNhbGwodm0sIFByb21pc2UpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHJlcXVlc3QpIHtcblxuICAgICAgICAgICAgICAgIGlmIChfLmlzRnVuY3Rpb24oaGFuZGxlci5yZXF1ZXN0KSkge1xuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0ID0gaGFuZGxlci5yZXF1ZXN0LmNhbGwodm0sIHJlcXVlc3QpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiB3aGVuKHJlcXVlc3QsIGZ1bmN0aW9uIChyZXF1ZXN0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB3aGVuKGNsaWVudChyZXF1ZXN0KSwgZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChfLmlzRnVuY3Rpb24oaGFuZGxlci5yZXNwb25zZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNwb25zZSA9IGhhbmRsZXIucmVzcG9uc2UuY2FsbCh2bSwgcmVzcG9uc2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzcG9uc2U7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gd2hlbih2YWx1ZSwgZnVsZmlsbGVkLCByZWplY3RlZCkge1xuXG4gICAgICAgIHZhciBwcm9taXNlID0gUHJvbWlzZS5yZXNvbHZlKHZhbHVlKTtcblxuICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHByb21pc2UudGhlbihmdWxmaWxsZWQsIHJlamVjdGVkKTtcbiAgICB9XG5cbn07XG4iLCIvKipcbiAqIEpTT05QIEludGVyY2VwdG9yLlxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKF8pIHtcblxuICAgIHZhciBqc29ucENsaWVudCA9IHJlcXVpcmUoJy4uL2NsaWVudC9qc29ucCcpKF8pO1xuXG4gICAgcmV0dXJuIHtcblxuICAgICAgICByZXF1ZXN0OiBmdW5jdGlvbiAocmVxdWVzdCkge1xuXG4gICAgICAgICAgICBpZiAocmVxdWVzdC5tZXRob2QgPT0gJ0pTT05QJykge1xuICAgICAgICAgICAgICAgIHJlcXVlc3QuY2xpZW50ID0ganNvbnBDbGllbnQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiByZXF1ZXN0O1xuICAgICAgICB9XG5cbiAgICB9O1xuXG59O1xuIiwiLyoqXG4gKiBIVFRQIG1ldGhvZCBvdmVycmlkZSBJbnRlcmNlcHRvci5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChfKSB7XG5cbiAgICByZXR1cm4ge1xuXG4gICAgICAgIHJlcXVlc3Q6IGZ1bmN0aW9uIChyZXF1ZXN0KSB7XG5cbiAgICAgICAgICAgIGlmIChyZXF1ZXN0LmVtdWxhdGVIVFRQICYmIC9eKFBVVHxQQVRDSHxERUxFVEUpJC9pLnRlc3QocmVxdWVzdC5tZXRob2QpKSB7XG4gICAgICAgICAgICAgICAgcmVxdWVzdC5oZWFkZXJzWydYLUhUVFAtTWV0aG9kLU92ZXJyaWRlJ10gPSByZXF1ZXN0Lm1ldGhvZDtcbiAgICAgICAgICAgICAgICByZXF1ZXN0Lm1ldGhvZCA9ICdQT1NUJztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHJlcXVlc3Q7XG4gICAgICAgIH1cblxuICAgIH07XG5cbn07XG4iLCIvKipcbiAqIE1pbWUgSW50ZXJjZXB0b3IuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoXykge1xuXG4gICAgcmV0dXJuIHtcblxuICAgICAgICByZXF1ZXN0OiBmdW5jdGlvbiAocmVxdWVzdCkge1xuXG4gICAgICAgICAgICBpZiAocmVxdWVzdC5lbXVsYXRlSlNPTiAmJiBfLmlzUGxhaW5PYmplY3QocmVxdWVzdC5kYXRhKSkge1xuICAgICAgICAgICAgICAgIHJlcXVlc3QuaGVhZGVyc1snQ29udGVudC1UeXBlJ10gPSAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkJztcbiAgICAgICAgICAgICAgICByZXF1ZXN0LmRhdGEgPSBfLnVybC5wYXJhbXMocmVxdWVzdC5kYXRhKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKF8uaXNPYmplY3QocmVxdWVzdC5kYXRhKSAmJiAvRm9ybURhdGEvaS50ZXN0KHJlcXVlc3QuZGF0YS50b1N0cmluZygpKSkge1xuICAgICAgICAgICAgICAgIGRlbGV0ZSByZXF1ZXN0LmhlYWRlcnNbJ0NvbnRlbnQtVHlwZSddO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoXy5pc1BsYWluT2JqZWN0KHJlcXVlc3QuZGF0YSkpIHtcbiAgICAgICAgICAgICAgICByZXF1ZXN0LmRhdGEgPSBKU09OLnN0cmluZ2lmeShyZXF1ZXN0LmRhdGEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gcmVxdWVzdDtcbiAgICAgICAgfSxcblxuICAgICAgICByZXNwb25zZTogZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcmVzcG9uc2UuZGF0YSA9IEpTT04ucGFyc2UocmVzcG9uc2UuZGF0YSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7fVxuXG4gICAgICAgICAgICByZXR1cm4gcmVzcG9uc2U7XG4gICAgICAgIH1cblxuICAgIH07XG5cbn07XG4iLCIvKipcbiAqIFRpbWVvdXQgSW50ZXJjZXB0b3IuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoXykge1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcblxuICAgICAgICB2YXIgdGltZW91dDtcblxuICAgICAgICByZXR1cm4ge1xuXG4gICAgICAgICAgICByZXF1ZXN0OiBmdW5jdGlvbiAocmVxdWVzdCkge1xuXG4gICAgICAgICAgICAgICAgaWYgKHJlcXVlc3QudGltZW91dCkge1xuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0ID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXF1ZXN0LmNhbmNlbCgpO1xuICAgICAgICAgICAgICAgICAgICB9LCByZXF1ZXN0LnRpbWVvdXQpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiByZXF1ZXN0O1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgcmVzcG9uc2U6IGZ1bmN0aW9uIChyZXNwb25zZSkge1xuXG4gICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH07XG4gICAgfTtcblxufTtcbiIsIi8qKlxuICogUHJvbWlzZXMvQSsgcG9seWZpbGwgdjEuMS40IChodHRwczovL2dpdGh1Yi5jb20vYnJhbXN0ZWluL3Byb21pcylcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChfKSB7XG5cbiAgICB2YXIgUkVTT0xWRUQgPSAwO1xuICAgIHZhciBSRUpFQ1RFRCA9IDE7XG4gICAgdmFyIFBFTkRJTkcgID0gMjtcblxuICAgIGZ1bmN0aW9uIFByb21pc2UoZXhlY3V0b3IpIHtcblxuICAgICAgICB0aGlzLnN0YXRlID0gUEVORElORztcbiAgICAgICAgdGhpcy52YWx1ZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5kZWZlcnJlZCA9IFtdO1xuXG4gICAgICAgIHZhciBwcm9taXNlID0gdGhpcztcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgZXhlY3V0b3IoZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgICAgICAgICBwcm9taXNlLnJlc29sdmUoeCk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAocikge1xuICAgICAgICAgICAgICAgIHByb21pc2UucmVqZWN0KHIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHByb21pc2UucmVqZWN0KGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgUHJvbWlzZS5yZWplY3QgPSBmdW5jdGlvbiAocikge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgcmVqZWN0KHIpO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgUHJvbWlzZS5yZXNvbHZlID0gZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgIHJlc29sdmUoeCk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBQcm9taXNlLmFsbCA9IGZ1bmN0aW9uIGFsbChpdGVyYWJsZSkge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgdmFyIGNvdW50ID0gMCwgcmVzdWx0ID0gW107XG5cbiAgICAgICAgICAgIGlmIChpdGVyYWJsZS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3VsdCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIHJlc29sdmVyKGkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0W2ldID0geDtcbiAgICAgICAgICAgICAgICAgICAgY291bnQgKz0gMTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoY291bnQgPT09IGl0ZXJhYmxlLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShyZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBpdGVyYWJsZS5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgICAgICAgIFByb21pc2UucmVzb2x2ZShpdGVyYWJsZVtpXSkudGhlbihyZXNvbHZlcihpKSwgcmVqZWN0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIFByb21pc2UucmFjZSA9IGZ1bmN0aW9uIHJhY2UoaXRlcmFibGUpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaXRlcmFibGUubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICBQcm9taXNlLnJlc29sdmUoaXRlcmFibGVbaV0pLnRoZW4ocmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIHZhciBwID0gUHJvbWlzZS5wcm90b3R5cGU7XG5cbiAgICBwLnJlc29sdmUgPSBmdW5jdGlvbiByZXNvbHZlKHgpIHtcbiAgICAgICAgdmFyIHByb21pc2UgPSB0aGlzO1xuXG4gICAgICAgIGlmIChwcm9taXNlLnN0YXRlID09PSBQRU5ESU5HKSB7XG4gICAgICAgICAgICBpZiAoeCA9PT0gcHJvbWlzZSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Byb21pc2Ugc2V0dGxlZCB3aXRoIGl0c2VsZi4nKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGNhbGxlZCA9IGZhbHNlO1xuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHZhciB0aGVuID0geCAmJiB4Wyd0aGVuJ107XG5cbiAgICAgICAgICAgICAgICBpZiAoeCAhPT0gbnVsbCAmJiB0eXBlb2YgeCA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIHRoZW4gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhlbi5jYWxsKHgsIGZ1bmN0aW9uICh4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWNhbGxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb21pc2UucmVzb2x2ZSh4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxlZCA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAgICAgfSwgZnVuY3Rpb24gKHIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghY2FsbGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvbWlzZS5yZWplY3Qocik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWNhbGxlZCkge1xuICAgICAgICAgICAgICAgICAgICBwcm9taXNlLnJlamVjdChlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBwcm9taXNlLnN0YXRlID0gUkVTT0xWRUQ7XG4gICAgICAgICAgICBwcm9taXNlLnZhbHVlID0geDtcbiAgICAgICAgICAgIHByb21pc2Uubm90aWZ5KCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgcC5yZWplY3QgPSBmdW5jdGlvbiByZWplY3QocmVhc29uKSB7XG4gICAgICAgIHZhciBwcm9taXNlID0gdGhpcztcblxuICAgICAgICBpZiAocHJvbWlzZS5zdGF0ZSA9PT0gUEVORElORykge1xuICAgICAgICAgICAgaWYgKHJlYXNvbiA9PT0gcHJvbWlzZSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Byb21pc2Ugc2V0dGxlZCB3aXRoIGl0c2VsZi4nKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcHJvbWlzZS5zdGF0ZSA9IFJFSkVDVEVEO1xuICAgICAgICAgICAgcHJvbWlzZS52YWx1ZSA9IHJlYXNvbjtcbiAgICAgICAgICAgIHByb21pc2Uubm90aWZ5KCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgcC5ub3RpZnkgPSBmdW5jdGlvbiBub3RpZnkoKSB7XG4gICAgICAgIHZhciBwcm9taXNlID0gdGhpcztcblxuICAgICAgICBfLm5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChwcm9taXNlLnN0YXRlICE9PSBQRU5ESU5HKSB7XG4gICAgICAgICAgICAgICAgd2hpbGUgKHByb21pc2UuZGVmZXJyZWQubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBkZWZlcnJlZCA9IHByb21pc2UuZGVmZXJyZWQuc2hpZnQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uUmVzb2x2ZWQgPSBkZWZlcnJlZFswXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uUmVqZWN0ZWQgPSBkZWZlcnJlZFsxXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUgPSBkZWZlcnJlZFsyXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdCA9IGRlZmVycmVkWzNdO1xuXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocHJvbWlzZS5zdGF0ZSA9PT0gUkVTT0xWRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG9uUmVzb2x2ZWQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShvblJlc29sdmVkLmNhbGwodW5kZWZpbmVkLCBwcm9taXNlLnZhbHVlKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShwcm9taXNlLnZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHByb21pc2Uuc3RhdGUgPT09IFJFSkVDVEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBvblJlamVjdGVkID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUob25SZWplY3RlZC5jYWxsKHVuZGVmaW5lZCwgcHJvbWlzZS52YWx1ZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChwcm9taXNlLnZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIHAudGhlbiA9IGZ1bmN0aW9uIHRoZW4ob25SZXNvbHZlZCwgb25SZWplY3RlZCkge1xuICAgICAgICB2YXIgcHJvbWlzZSA9IHRoaXM7XG5cbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgIHByb21pc2UuZGVmZXJyZWQucHVzaChbb25SZXNvbHZlZCwgb25SZWplY3RlZCwgcmVzb2x2ZSwgcmVqZWN0XSk7XG4gICAgICAgICAgICBwcm9taXNlLm5vdGlmeSgpO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgcC5jYXRjaCA9IGZ1bmN0aW9uIChvblJlamVjdGVkKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRoZW4odW5kZWZpbmVkLCBvblJlamVjdGVkKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIFByb21pc2U7XG59O1xuIiwiLyoqXG4gKiBVUkwgVGVtcGxhdGUgdjIuMC42IChodHRwczovL2dpdGh1Yi5jb20vYnJhbXN0ZWluL3VybC10ZW1wbGF0ZSlcbiAqL1xuXG5leHBvcnRzLmV4cGFuZCA9IGZ1bmN0aW9uICh1cmwsIHBhcmFtcywgdmFyaWFibGVzKSB7XG5cbiAgICB2YXIgdG1wbCA9IHRoaXMucGFyc2UodXJsKSwgZXhwYW5kZWQgPSB0bXBsLmV4cGFuZChwYXJhbXMpO1xuXG4gICAgaWYgKHZhcmlhYmxlcykge1xuICAgICAgICB2YXJpYWJsZXMucHVzaC5hcHBseSh2YXJpYWJsZXMsIHRtcGwudmFycyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGV4cGFuZGVkO1xufTtcblxuZXhwb3J0cy5wYXJzZSA9IGZ1bmN0aW9uICh0ZW1wbGF0ZSkge1xuXG4gICAgdmFyIG9wZXJhdG9ycyA9IFsnKycsICcjJywgJy4nLCAnLycsICc7JywgJz8nLCAnJiddLCB2YXJpYWJsZXMgPSBbXTtcblxuICAgIHJldHVybiB7XG4gICAgICAgIHZhcnM6IHZhcmlhYmxlcyxcbiAgICAgICAgZXhwYW5kOiBmdW5jdGlvbiAoY29udGV4dCkge1xuICAgICAgICAgICAgcmV0dXJuIHRlbXBsYXRlLnJlcGxhY2UoL1xceyhbXlxce1xcfV0rKVxcfXwoW15cXHtcXH1dKykvZywgZnVuY3Rpb24gKF8sIGV4cHJlc3Npb24sIGxpdGVyYWwpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXhwcmVzc2lvbikge1xuXG4gICAgICAgICAgICAgICAgICAgIHZhciBvcGVyYXRvciA9IG51bGwsIHZhbHVlcyA9IFtdO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcGVyYXRvcnMuaW5kZXhPZihleHByZXNzaW9uLmNoYXJBdCgwKSkgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcGVyYXRvciA9IGV4cHJlc3Npb24uY2hhckF0KDApO1xuICAgICAgICAgICAgICAgICAgICAgICAgZXhwcmVzc2lvbiA9IGV4cHJlc3Npb24uc3Vic3RyKDEpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgZXhwcmVzc2lvbi5zcGxpdCgvLC9nKS5mb3JFYWNoKGZ1bmN0aW9uICh2YXJpYWJsZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHRtcCA9IC8oW146XFwqXSopKD86OihcXGQrKXwoXFwqKSk/Ly5leGVjKHZhcmlhYmxlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlcy5wdXNoLmFwcGx5KHZhbHVlcywgZXhwb3J0cy5nZXRWYWx1ZXMoY29udGV4dCwgb3BlcmF0b3IsIHRtcFsxXSwgdG1wWzJdIHx8IHRtcFszXSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFibGVzLnB1c2godG1wWzFdKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wZXJhdG9yICYmIG9wZXJhdG9yICE9PSAnKycpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHNlcGFyYXRvciA9ICcsJztcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9wZXJhdG9yID09PSAnPycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXBhcmF0b3IgPSAnJic7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG9wZXJhdG9yICE9PSAnIycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXBhcmF0b3IgPSBvcGVyYXRvcjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICh2YWx1ZXMubGVuZ3RoICE9PSAwID8gb3BlcmF0b3IgOiAnJykgKyB2YWx1ZXMuam9pbihzZXBhcmF0b3IpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlcy5qb2luKCcsJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBleHBvcnRzLmVuY29kZVJlc2VydmVkKGxpdGVyYWwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcbn07XG5cbmV4cG9ydHMuZ2V0VmFsdWVzID0gZnVuY3Rpb24gKGNvbnRleHQsIG9wZXJhdG9yLCBrZXksIG1vZGlmaWVyKSB7XG5cbiAgICB2YXIgdmFsdWUgPSBjb250ZXh0W2tleV0sIHJlc3VsdCA9IFtdO1xuXG4gICAgaWYgKHRoaXMuaXNEZWZpbmVkKHZhbHVlKSAmJiB2YWx1ZSAhPT0gJycpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyB8fCB0eXBlb2YgdmFsdWUgPT09ICdib29sZWFuJykge1xuICAgICAgICAgICAgdmFsdWUgPSB2YWx1ZS50b1N0cmluZygpO1xuXG4gICAgICAgICAgICBpZiAobW9kaWZpZXIgJiYgbW9kaWZpZXIgIT09ICcqJykge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gdmFsdWUuc3Vic3RyaW5nKDAsIHBhcnNlSW50KG1vZGlmaWVyLCAxMCkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXN1bHQucHVzaCh0aGlzLmVuY29kZVZhbHVlKG9wZXJhdG9yLCB2YWx1ZSwgdGhpcy5pc0tleU9wZXJhdG9yKG9wZXJhdG9yKSA/IGtleSA6IG51bGwpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChtb2RpZmllciA9PT0gJyonKSB7XG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlLmZpbHRlcih0aGlzLmlzRGVmaW5lZCkuZm9yRWFjaChmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKHRoaXMuZW5jb2RlVmFsdWUob3BlcmF0b3IsIHZhbHVlLCB0aGlzLmlzS2V5T3BlcmF0b3Iob3BlcmF0b3IpID8ga2V5IDogbnVsbCkpO1xuICAgICAgICAgICAgICAgICAgICB9LCB0aGlzKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBPYmplY3Qua2V5cyh2YWx1ZSkuZm9yRWFjaChmdW5jdGlvbiAoaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuaXNEZWZpbmVkKHZhbHVlW2tdKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKHRoaXMuZW5jb2RlVmFsdWUob3BlcmF0b3IsIHZhbHVlW2tdLCBrKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0sIHRoaXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIHRtcCA9IFtdO1xuXG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlLmZpbHRlcih0aGlzLmlzRGVmaW5lZCkuZm9yRWFjaChmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRtcC5wdXNoKHRoaXMuZW5jb2RlVmFsdWUob3BlcmF0b3IsIHZhbHVlKSk7XG4gICAgICAgICAgICAgICAgICAgIH0sIHRoaXMpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIE9iamVjdC5rZXlzKHZhbHVlKS5mb3JFYWNoKGZ1bmN0aW9uIChrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5pc0RlZmluZWQodmFsdWVba10pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdG1wLnB1c2goZW5jb2RlVVJJQ29tcG9uZW50KGspKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0bXAucHVzaCh0aGlzLmVuY29kZVZhbHVlKG9wZXJhdG9yLCB2YWx1ZVtrXS50b1N0cmluZygpKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0sIHRoaXMpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmlzS2V5T3BlcmF0b3Iob3BlcmF0b3IpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKGVuY29kZVVSSUNvbXBvbmVudChrZXkpICsgJz0nICsgdG1wLmpvaW4oJywnKSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0bXAubGVuZ3RoICE9PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKHRtcC5qb2luKCcsJykpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChvcGVyYXRvciA9PT0gJzsnKSB7XG4gICAgICAgICAgICByZXN1bHQucHVzaChlbmNvZGVVUklDb21wb25lbnQoa2V5KSk7XG4gICAgICAgIH0gZWxzZSBpZiAodmFsdWUgPT09ICcnICYmIChvcGVyYXRvciA9PT0gJyYnIHx8IG9wZXJhdG9yID09PSAnPycpKSB7XG4gICAgICAgICAgICByZXN1bHQucHVzaChlbmNvZGVVUklDb21wb25lbnQoa2V5KSArICc9Jyk7XG4gICAgICAgIH0gZWxzZSBpZiAodmFsdWUgPT09ICcnKSB7XG4gICAgICAgICAgICByZXN1bHQucHVzaCgnJyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuZXhwb3J0cy5pc0RlZmluZWQgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbDtcbn07XG5cbmV4cG9ydHMuaXNLZXlPcGVyYXRvciA9IGZ1bmN0aW9uIChvcGVyYXRvcikge1xuICAgIHJldHVybiBvcGVyYXRvciA9PT0gJzsnIHx8IG9wZXJhdG9yID09PSAnJicgfHwgb3BlcmF0b3IgPT09ICc/Jztcbn07XG5cbmV4cG9ydHMuZW5jb2RlVmFsdWUgPSBmdW5jdGlvbiAob3BlcmF0b3IsIHZhbHVlLCBrZXkpIHtcblxuICAgIHZhbHVlID0gKG9wZXJhdG9yID09PSAnKycgfHwgb3BlcmF0b3IgPT09ICcjJykgPyB0aGlzLmVuY29kZVJlc2VydmVkKHZhbHVlKSA6IGVuY29kZVVSSUNvbXBvbmVudCh2YWx1ZSk7XG5cbiAgICBpZiAoa2V5KSB7XG4gICAgICAgIHJldHVybiBlbmNvZGVVUklDb21wb25lbnQoa2V5KSArICc9JyArIHZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG59O1xuXG5leHBvcnRzLmVuY29kZVJlc2VydmVkID0gZnVuY3Rpb24gKHN0cikge1xuICAgIHJldHVybiBzdHIuc3BsaXQoLyglWzAtOUEtRmEtZl17Mn0pL2cpLm1hcChmdW5jdGlvbiAocGFydCkge1xuICAgICAgICBpZiAoIS8lWzAtOUEtRmEtZl0vLnRlc3QocGFydCkpIHtcbiAgICAgICAgICAgIHBhcnQgPSBlbmNvZGVVUkkocGFydCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHBhcnQ7XG4gICAgfSkuam9pbignJyk7XG59O1xuIiwiLyoqXG4gKiBVdGlsaXR5IGZ1bmN0aW9ucy5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChWdWUpIHtcblxuICAgIHZhciBfID0gVnVlLnV0aWwuZXh0ZW5kKHt9LCBWdWUudXRpbCksIGNvbmZpZyA9IFZ1ZS5jb25maWcsIGNvbnNvbGUgPSB3aW5kb3cuY29uc29sZTtcblxuICAgIF8ud2FybiA9IGZ1bmN0aW9uIChtc2cpIHtcbiAgICAgICAgaWYgKGNvbnNvbGUgJiYgVnVlLnV0aWwud2FybiAmJiAoIWNvbmZpZy5zaWxlbnQgfHwgY29uZmlnLmRlYnVnKSkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKCdbVnVlUmVzb3VyY2Ugd2Fybl06ICcgKyBtc2cpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIF8uZXJyb3IgPSBmdW5jdGlvbiAobXNnKSB7XG4gICAgICAgIGlmIChjb25zb2xlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKG1zZyk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgXy50cmltID0gZnVuY3Rpb24gKHN0cikge1xuICAgICAgICByZXR1cm4gc3RyLnJlcGxhY2UoL15cXHMqfFxccyokL2csICcnKTtcbiAgICB9O1xuXG4gICAgXy50b0xvd2VyID0gZnVuY3Rpb24gKHN0cikge1xuICAgICAgICByZXR1cm4gc3RyID8gc3RyLnRvTG93ZXJDYXNlKCkgOiAnJztcbiAgICB9O1xuXG4gICAgXy5pc1N0cmluZyA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJztcbiAgICB9O1xuXG4gICAgXy5pc0Z1bmN0aW9uID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbic7XG4gICAgfTtcblxuICAgIF8ub3B0aW9ucyA9IGZ1bmN0aW9uIChmbiwgb2JqLCBvcHRpb25zKSB7XG5cbiAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICAgICAgaWYgKF8uaXNGdW5jdGlvbihvcHRpb25zKSkge1xuICAgICAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMuY2FsbChvYmopO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIF8uZXh0ZW5kKGZuLmJpbmQoe3ZtOiBvYmosIG9wdGlvbnM6IG9wdGlvbnN9KSwgZm4sIHtvcHRpb25zOiBvcHRpb25zfSk7XG4gICAgfTtcblxuICAgIF8uZWFjaCA9IGZ1bmN0aW9uIChvYmosIGl0ZXJhdG9yKSB7XG5cbiAgICAgICAgdmFyIGksIGtleTtcblxuICAgICAgICBpZiAodHlwZW9mIG9iai5sZW5ndGggPT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBvYmoubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpdGVyYXRvci5jYWxsKG9ialtpXSwgb2JqW2ldLCBpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChfLmlzT2JqZWN0KG9iaikpIHtcbiAgICAgICAgICAgIGZvciAoa2V5IGluIG9iaikge1xuICAgICAgICAgICAgICAgIGlmIChvYmouaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgICAgICBpdGVyYXRvci5jYWxsKG9ialtrZXldLCBvYmpba2V5XSwga2V5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gb2JqO1xuICAgIH07XG5cbiAgICBfLmV4dGVuZCA9IGZ1bmN0aW9uICh0YXJnZXQpIHtcblxuICAgICAgICB2YXIgYXJyYXkgPSBbXSwgYXJncyA9IGFycmF5LnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSwgZGVlcDtcblxuICAgICAgICBpZiAodHlwZW9mIHRhcmdldCA9PSAnYm9vbGVhbicpIHtcbiAgICAgICAgICAgIGRlZXAgPSB0YXJnZXQ7XG4gICAgICAgICAgICB0YXJnZXQgPSBhcmdzLnNoaWZ0KCk7XG4gICAgICAgIH1cblxuICAgICAgICBhcmdzLmZvckVhY2goZnVuY3Rpb24gKGFyZykge1xuICAgICAgICAgICAgZXh0ZW5kKHRhcmdldCwgYXJnLCBkZWVwKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gZXh0ZW5kKHRhcmdldCwgc291cmNlLCBkZWVwKSB7XG4gICAgICAgIGZvciAodmFyIGtleSBpbiBzb3VyY2UpIHtcbiAgICAgICAgICAgIGlmIChkZWVwICYmIChfLmlzUGxhaW5PYmplY3Qoc291cmNlW2tleV0pIHx8IF8uaXNBcnJheShzb3VyY2Vba2V5XSkpKSB7XG4gICAgICAgICAgICAgICAgaWYgKF8uaXNQbGFpbk9iamVjdChzb3VyY2Vba2V5XSkgJiYgIV8uaXNQbGFpbk9iamVjdCh0YXJnZXRba2V5XSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W2tleV0gPSB7fTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKF8uaXNBcnJheShzb3VyY2Vba2V5XSkgJiYgIV8uaXNBcnJheSh0YXJnZXRba2V5XSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W2tleV0gPSBbXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZXh0ZW5kKHRhcmdldFtrZXldLCBzb3VyY2Vba2V5XSwgZGVlcCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHNvdXJjZVtrZXldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRba2V5XSA9IHNvdXJjZVtrZXldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIF87XG59O1xuIiwiLyoqXG4gKiBQcm9taXNlIGFkYXB0ZXIuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoXykge1xuXG4gICAgdmFyIFByb21pc2UgPSB3aW5kb3cuUHJvbWlzZSB8fCByZXF1aXJlKCcuL2xpYi9wcm9taXNlJykoXyk7XG5cbiAgICB2YXIgQWRhcHRlciA9IGZ1bmN0aW9uIChleGVjdXRvcikge1xuXG4gICAgICAgIGlmIChleGVjdXRvciBpbnN0YW5jZW9mIFByb21pc2UpIHtcbiAgICAgICAgICAgIHRoaXMucHJvbWlzZSA9IGV4ZWN1dG9yO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5wcm9taXNlID0gbmV3IFByb21pc2UoZXhlY3V0b3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jb250ZXh0ID0gdW5kZWZpbmVkO1xuICAgIH07XG5cbiAgICBBZGFwdGVyLmFsbCA9IGZ1bmN0aW9uIChpdGVyYWJsZSkge1xuICAgICAgICByZXR1cm4gbmV3IEFkYXB0ZXIoUHJvbWlzZS5hbGwoaXRlcmFibGUpKTtcbiAgICB9O1xuXG4gICAgQWRhcHRlci5yZXNvbHZlID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiBuZXcgQWRhcHRlcihQcm9taXNlLnJlc29sdmUodmFsdWUpKTtcbiAgICB9O1xuXG4gICAgQWRhcHRlci5yZWplY3QgPSBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICAgIHJldHVybiBuZXcgQWRhcHRlcihQcm9taXNlLnJlamVjdChyZWFzb24pKTtcbiAgICB9O1xuXG4gICAgQWRhcHRlci5yYWNlID0gZnVuY3Rpb24gKGl0ZXJhYmxlKSB7XG4gICAgICAgIHJldHVybiBuZXcgQWRhcHRlcihQcm9taXNlLnJhY2UoaXRlcmFibGUpKTtcbiAgICB9O1xuXG4gICAgdmFyIHAgPSBBZGFwdGVyLnByb3RvdHlwZTtcblxuICAgIHAuYmluZCA9IGZ1bmN0aW9uIChjb250ZXh0KSB7XG4gICAgICAgIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICBwLnRoZW4gPSBmdW5jdGlvbiAoZnVsZmlsbGVkLCByZWplY3RlZCkge1xuXG4gICAgICAgIGlmIChmdWxmaWxsZWQgJiYgZnVsZmlsbGVkLmJpbmQgJiYgdGhpcy5jb250ZXh0KSB7XG4gICAgICAgICAgICBmdWxmaWxsZWQgPSBmdWxmaWxsZWQuYmluZCh0aGlzLmNvbnRleHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHJlamVjdGVkICYmIHJlamVjdGVkLmJpbmQgJiYgdGhpcy5jb250ZXh0KSB7XG4gICAgICAgICAgICByZWplY3RlZCA9IHJlamVjdGVkLmJpbmQodGhpcy5jb250ZXh0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucHJvbWlzZSA9IHRoaXMucHJvbWlzZS50aGVuKGZ1bGZpbGxlZCwgcmVqZWN0ZWQpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICBwLmNhdGNoID0gZnVuY3Rpb24gKHJlamVjdGVkKSB7XG5cbiAgICAgICAgaWYgKHJlamVjdGVkICYmIHJlamVjdGVkLmJpbmQgJiYgdGhpcy5jb250ZXh0KSB7XG4gICAgICAgICAgICByZWplY3RlZCA9IHJlamVjdGVkLmJpbmQodGhpcy5jb250ZXh0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucHJvbWlzZSA9IHRoaXMucHJvbWlzZS5jYXRjaChyZWplY3RlZCk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuICAgIHAuZmluYWxseSA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuXG4gICAgICAgIHJldHVybiB0aGlzLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2suY2FsbCh0aGlzKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2suY2FsbCh0aGlzKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QocmVhc29uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICB9O1xuXG4gICAgcC5zdWNjZXNzID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG5cbiAgICAgICAgXy53YXJuKCdUaGUgYHN1Y2Nlc3NgIG1ldGhvZCBoYXMgYmVlbiBkZXByZWNhdGVkLiBVc2UgdGhlIGB0aGVuYCBtZXRob2QgaW5zdGVhZC4nKTtcblxuICAgICAgICByZXR1cm4gdGhpcy50aGVuKGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrLmNhbGwodGhpcywgcmVzcG9uc2UuZGF0YSwgcmVzcG9uc2Uuc3RhdHVzLCByZXNwb25zZSkgfHwgcmVzcG9uc2U7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBwLmVycm9yID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG5cbiAgICAgICAgXy53YXJuKCdUaGUgYGVycm9yYCBtZXRob2QgaGFzIGJlZW4gZGVwcmVjYXRlZC4gVXNlIHRoZSBgY2F0Y2hgIG1ldGhvZCBpbnN0ZWFkLicpO1xuXG4gICAgICAgIHJldHVybiB0aGlzLmNhdGNoKGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrLmNhbGwodGhpcywgcmVzcG9uc2UuZGF0YSwgcmVzcG9uc2Uuc3RhdHVzLCByZXNwb25zZSkgfHwgcmVzcG9uc2U7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBwLmFsd2F5cyA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuXG4gICAgICAgIF8ud2FybignVGhlIGBhbHdheXNgIG1ldGhvZCBoYXMgYmVlbiBkZXByZWNhdGVkLiBVc2UgdGhlIGBmaW5hbGx5YCBtZXRob2QgaW5zdGVhZC4nKTtcblxuICAgICAgICB2YXIgY2IgPSBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjay5jYWxsKHRoaXMsIHJlc3BvbnNlLmRhdGEsIHJlc3BvbnNlLnN0YXR1cywgcmVzcG9uc2UpIHx8IHJlc3BvbnNlO1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiB0aGlzLnRoZW4oY2IsIGNiKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIEFkYXB0ZXI7XG59O1xuIiwiLyoqXG4gKiBTZXJ2aWNlIGZvciBpbnRlcmFjdGluZyB3aXRoIFJFU1RmdWwgc2VydmljZXMuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoXykge1xuXG4gICAgZnVuY3Rpb24gUmVzb3VyY2UodXJsLCBwYXJhbXMsIGFjdGlvbnMsIG9wdGlvbnMpIHtcblxuICAgICAgICB2YXIgc2VsZiA9IHRoaXMsIHJlc291cmNlID0ge307XG5cbiAgICAgICAgYWN0aW9ucyA9IF8uZXh0ZW5kKHt9LFxuICAgICAgICAgICAgUmVzb3VyY2UuYWN0aW9ucyxcbiAgICAgICAgICAgIGFjdGlvbnNcbiAgICAgICAgKTtcblxuICAgICAgICBfLmVhY2goYWN0aW9ucywgZnVuY3Rpb24gKGFjdGlvbiwgbmFtZSkge1xuXG4gICAgICAgICAgICBhY3Rpb24gPSBfLmV4dGVuZCh0cnVlLCB7dXJsOiB1cmwsIHBhcmFtczogcGFyYW1zIHx8IHt9fSwgb3B0aW9ucywgYWN0aW9uKTtcblxuICAgICAgICAgICAgcmVzb3VyY2VbbmFtZV0gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIChzZWxmLiRodHRwIHx8IF8uaHR0cCkob3B0cyhhY3Rpb24sIGFyZ3VtZW50cykpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9wdHMoYWN0aW9uLCBhcmdzKSB7XG5cbiAgICAgICAgdmFyIG9wdGlvbnMgPSBfLmV4dGVuZCh7fSwgYWN0aW9uKSwgcGFyYW1zID0ge30sIGRhdGEsIHN1Y2Nlc3MsIGVycm9yO1xuXG4gICAgICAgIHN3aXRjaCAoYXJncy5sZW5ndGgpIHtcblxuICAgICAgICAgICAgY2FzZSA0OlxuXG4gICAgICAgICAgICAgICAgZXJyb3IgPSBhcmdzWzNdO1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPSBhcmdzWzJdO1xuXG4gICAgICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgICBjYXNlIDI6XG5cbiAgICAgICAgICAgICAgICBpZiAoXy5pc0Z1bmN0aW9uKGFyZ3NbMV0pKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKF8uaXNGdW5jdGlvbihhcmdzWzBdKSkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBzdWNjZXNzID0gYXJnc1swXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yID0gYXJnc1sxXTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzID0gYXJnc1sxXTtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3IgPSBhcmdzWzJdO1xuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICBwYXJhbXMgPSBhcmdzWzBdO1xuICAgICAgICAgICAgICAgICAgICBkYXRhID0gYXJnc1sxXTtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzcyA9IGFyZ3NbMl07XG5cbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjYXNlIDE6XG5cbiAgICAgICAgICAgICAgICBpZiAoXy5pc0Z1bmN0aW9uKGFyZ3NbMF0pKSB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPSBhcmdzWzBdO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoL14oUE9TVHxQVVR8UEFUQ0gpJC9pLnRlc3Qob3B0aW9ucy5tZXRob2QpKSB7XG4gICAgICAgICAgICAgICAgICAgIGRhdGEgPSBhcmdzWzBdO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcyA9IGFyZ3NbMF07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgMDpcblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBkZWZhdWx0OlxuXG4gICAgICAgICAgICAgICAgdGhyb3cgJ0V4cGVjdGVkIHVwIHRvIDQgYXJndW1lbnRzIFtwYXJhbXMsIGRhdGEsIHN1Y2Nlc3MsIGVycm9yXSwgZ290ICcgKyBhcmdzLmxlbmd0aCArICcgYXJndW1lbnRzJztcbiAgICAgICAgfVxuXG4gICAgICAgIG9wdGlvbnMuZGF0YSA9IGRhdGE7XG4gICAgICAgIG9wdGlvbnMucGFyYW1zID0gXy5leHRlbmQoe30sIG9wdGlvbnMucGFyYW1zLCBwYXJhbXMpO1xuXG4gICAgICAgIGlmIChzdWNjZXNzKSB7XG4gICAgICAgICAgICBvcHRpb25zLnN1Y2Nlc3MgPSBzdWNjZXNzO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICBvcHRpb25zLmVycm9yID0gZXJyb3I7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gb3B0aW9ucztcbiAgICB9XG5cbiAgICBSZXNvdXJjZS5hY3Rpb25zID0ge1xuXG4gICAgICAgIGdldDoge21ldGhvZDogJ0dFVCd9LFxuICAgICAgICBzYXZlOiB7bWV0aG9kOiAnUE9TVCd9LFxuICAgICAgICBxdWVyeToge21ldGhvZDogJ0dFVCd9LFxuICAgICAgICB1cGRhdGU6IHttZXRob2Q6ICdQVVQnfSxcbiAgICAgICAgcmVtb3ZlOiB7bWV0aG9kOiAnREVMRVRFJ30sXG4gICAgICAgIGRlbGV0ZToge21ldGhvZDogJ0RFTEVURSd9XG5cbiAgICB9O1xuXG4gICAgcmV0dXJuIF8ucmVzb3VyY2UgPSBSZXNvdXJjZTtcbn07XG4iLCIvKipcbiAqIFNlcnZpY2UgZm9yIFVSTCB0ZW1wbGF0aW5nLlxuICovXG5cbnZhciBVcmxUZW1wbGF0ZSA9IHJlcXVpcmUoJy4vbGliL3VybC10ZW1wbGF0ZScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChfKSB7XG5cbiAgICB2YXIgaWUgPSBkb2N1bWVudC5kb2N1bWVudE1vZGU7XG4gICAgdmFyIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuXG4gICAgZnVuY3Rpb24gVXJsKHVybCwgcGFyYW1zKSB7XG5cbiAgICAgICAgdmFyIHVybFBhcmFtcyA9IE9iamVjdC5rZXlzKFVybC5vcHRpb25zLnBhcmFtcyksIHF1ZXJ5UGFyYW1zID0ge30sIG9wdGlvbnMgPSB1cmwsIHF1ZXJ5O1xuXG4gICAgICAgIGlmICghXy5pc1BsYWluT2JqZWN0KG9wdGlvbnMpKSB7XG4gICAgICAgICAgICBvcHRpb25zID0ge3VybDogdXJsLCBwYXJhbXM6IHBhcmFtc307XG4gICAgICAgIH1cblxuICAgICAgICBvcHRpb25zID0gXy5leHRlbmQodHJ1ZSwge30sXG4gICAgICAgICAgICBVcmwub3B0aW9ucywgdGhpcy5vcHRpb25zLCBvcHRpb25zXG4gICAgICAgICk7XG5cbiAgICAgICAgdXJsID0gVXJsVGVtcGxhdGUuZXhwYW5kKG9wdGlvbnMudXJsLCBvcHRpb25zLnBhcmFtcywgdXJsUGFyYW1zKTtcblxuICAgICAgICB1cmwgPSB1cmwucmVwbGFjZSgvKFxcLz8pOihbYS16XVxcdyopL2dpLCBmdW5jdGlvbiAobWF0Y2gsIHNsYXNoLCBuYW1lKSB7XG5cbiAgICAgICAgICAgIF8ud2FybignVGhlIGA6JyArIG5hbWUgKyAnYCBwYXJhbWV0ZXIgc3ludGF4IGhhcyBiZWVuIGRlcHJlY2F0ZWQuIFVzZSB0aGUgYHsnICsgbmFtZSArICd9YCBzeW50YXggaW5zdGVhZC4nKTtcblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMucGFyYW1zW25hbWVdKSB7XG4gICAgICAgICAgICAgICAgdXJsUGFyYW1zLnB1c2gobmFtZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNsYXNoICsgZW5jb2RlVXJpU2VnbWVudChvcHRpb25zLnBhcmFtc1tuYW1lXSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKF8uaXNTdHJpbmcob3B0aW9ucy5yb290KSAmJiAhdXJsLm1hdGNoKC9eKGh0dHBzPzopP1xcLy8pKSB7XG4gICAgICAgICAgICB1cmwgPSBvcHRpb25zLnJvb3QgKyAnLycgKyB1cmw7XG4gICAgICAgIH1cblxuICAgICAgICBfLmVhY2gob3B0aW9ucy5wYXJhbXMsIGZ1bmN0aW9uICh2YWx1ZSwga2V5KSB7XG4gICAgICAgICAgICBpZiAodXJsUGFyYW1zLmluZGV4T2Yoa2V5KSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICBxdWVyeVBhcmFtc1trZXldID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHF1ZXJ5ID0gVXJsLnBhcmFtcyhxdWVyeVBhcmFtcyk7XG5cbiAgICAgICAgaWYgKHF1ZXJ5KSB7XG4gICAgICAgICAgICB1cmwgKz0gKHVybC5pbmRleE9mKCc/JykgPT0gLTEgPyAnPycgOiAnJicpICsgcXVlcnk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdXJsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVybCBvcHRpb25zLlxuICAgICAqL1xuXG4gICAgVXJsLm9wdGlvbnMgPSB7XG4gICAgICAgIHVybDogJycsXG4gICAgICAgIHJvb3Q6IG51bGwsXG4gICAgICAgIHBhcmFtczoge31cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRW5jb2RlcyBhIFVybCBwYXJhbWV0ZXIgc3RyaW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9ialxuICAgICAqL1xuXG4gICAgVXJsLnBhcmFtcyA9IGZ1bmN0aW9uIChvYmopIHtcblxuICAgICAgICB2YXIgcGFyYW1zID0gW107XG5cbiAgICAgICAgcGFyYW1zLmFkZCA9IGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XG5cbiAgICAgICAgICAgIGlmIChfLmlzRnVuY3Rpb24gKHZhbHVlKSkge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gdmFsdWUoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHZhbHVlID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSAnJztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5wdXNoKGVuY29kZVVyaVNlZ21lbnQoa2V5KSArICc9JyArIGVuY29kZVVyaVNlZ21lbnQodmFsdWUpKTtcbiAgICAgICAgfTtcblxuICAgICAgICBzZXJpYWxpemUocGFyYW1zLCBvYmopO1xuXG4gICAgICAgIHJldHVybiBwYXJhbXMuam9pbignJicpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBQYXJzZSBhIFVSTCBhbmQgcmV0dXJuIGl0cyBjb21wb25lbnRzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHVybFxuICAgICAqL1xuXG4gICAgVXJsLnBhcnNlID0gZnVuY3Rpb24gKHVybCkge1xuXG4gICAgICAgIGlmIChpZSkge1xuICAgICAgICAgICAgZWwuaHJlZiA9IHVybDtcbiAgICAgICAgICAgIHVybCA9IGVsLmhyZWY7XG4gICAgICAgIH1cblxuICAgICAgICBlbC5ocmVmID0gdXJsO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBocmVmOiBlbC5ocmVmLFxuICAgICAgICAgICAgcHJvdG9jb2w6IGVsLnByb3RvY29sID8gZWwucHJvdG9jb2wucmVwbGFjZSgvOiQvLCAnJykgOiAnJyxcbiAgICAgICAgICAgIHBvcnQ6IGVsLnBvcnQsXG4gICAgICAgICAgICBob3N0OiBlbC5ob3N0LFxuICAgICAgICAgICAgaG9zdG5hbWU6IGVsLmhvc3RuYW1lLFxuICAgICAgICAgICAgcGF0aG5hbWU6IGVsLnBhdGhuYW1lLmNoYXJBdCgwKSA9PT0gJy8nID8gZWwucGF0aG5hbWUgOiAnLycgKyBlbC5wYXRobmFtZSxcbiAgICAgICAgICAgIHNlYXJjaDogZWwuc2VhcmNoID8gZWwuc2VhcmNoLnJlcGxhY2UoL15cXD8vLCAnJykgOiAnJyxcbiAgICAgICAgICAgIGhhc2g6IGVsLmhhc2ggPyBlbC5oYXNoLnJlcGxhY2UoL14jLywgJycpIDogJydcbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gc2VyaWFsaXplKHBhcmFtcywgb2JqLCBzY29wZSkge1xuXG4gICAgICAgIHZhciBhcnJheSA9IF8uaXNBcnJheShvYmopLCBwbGFpbiA9IF8uaXNQbGFpbk9iamVjdChvYmopLCBoYXNoO1xuXG4gICAgICAgIF8uZWFjaChvYmosIGZ1bmN0aW9uICh2YWx1ZSwga2V5KSB7XG5cbiAgICAgICAgICAgIGhhc2ggPSBfLmlzT2JqZWN0KHZhbHVlKSB8fCBfLmlzQXJyYXkodmFsdWUpO1xuXG4gICAgICAgICAgICBpZiAoc2NvcGUpIHtcbiAgICAgICAgICAgICAgICBrZXkgPSBzY29wZSArICdbJyArIChwbGFpbiB8fCBoYXNoID8ga2V5IDogJycpICsgJ10nO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIXNjb3BlICYmIGFycmF5KSB7XG4gICAgICAgICAgICAgICAgcGFyYW1zLmFkZCh2YWx1ZS5uYW1lLCB2YWx1ZS52YWx1ZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGhhc2gpIHtcbiAgICAgICAgICAgICAgICBzZXJpYWxpemUocGFyYW1zLCB2YWx1ZSwga2V5KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGFyYW1zLmFkZChrZXksIHZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZW5jb2RlVXJpU2VnbWVudCh2YWx1ZSkge1xuXG4gICAgICAgIHJldHVybiBlbmNvZGVVcmlRdWVyeSh2YWx1ZSwgdHJ1ZSkuXG4gICAgICAgICAgICByZXBsYWNlKC8lMjYvZ2ksICcmJykuXG4gICAgICAgICAgICByZXBsYWNlKC8lM0QvZ2ksICc9JykuXG4gICAgICAgICAgICByZXBsYWNlKC8lMkIvZ2ksICcrJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZW5jb2RlVXJpUXVlcnkodmFsdWUsIHNwYWNlcykge1xuXG4gICAgICAgIHJldHVybiBlbmNvZGVVUklDb21wb25lbnQodmFsdWUpLlxuICAgICAgICAgICAgcmVwbGFjZSgvJTQwL2dpLCAnQCcpLlxuICAgICAgICAgICAgcmVwbGFjZSgvJTNBL2dpLCAnOicpLlxuICAgICAgICAgICAgcmVwbGFjZSgvJTI0L2csICckJykuXG4gICAgICAgICAgICByZXBsYWNlKC8lMkMvZ2ksICcsJykuXG4gICAgICAgICAgICByZXBsYWNlKC8lMjAvZywgKHNwYWNlcyA/ICclMjAnIDogJysnKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIF8udXJsID0gVXJsO1xufTtcbiIsIi8qIVxuICogVnVlLmpzIHYxLjAuMTNcbiAqIChjKSAyMDE1IEV2YW4gWW91XG4gKiBSZWxlYXNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuXG4gKi9cbid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gc2V0KG9iaiwga2V5LCB2YWwpIHtcbiAgaWYgKGhhc093bihvYmosIGtleSkpIHtcbiAgICBvYmpba2V5XSA9IHZhbDtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKG9iai5faXNWdWUpIHtcbiAgICBzZXQob2JqLl9kYXRhLCBrZXksIHZhbCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIHZhciBvYiA9IG9iai5fX29iX187XG4gIGlmICghb2IpIHtcbiAgICBvYmpba2V5XSA9IHZhbDtcbiAgICByZXR1cm47XG4gIH1cbiAgb2IuY29udmVydChrZXksIHZhbCk7XG4gIG9iLmRlcC5ub3RpZnkoKTtcbiAgaWYgKG9iLnZtcykge1xuICAgIHZhciBpID0gb2Iudm1zLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICB2YXIgdm0gPSBvYi52bXNbaV07XG4gICAgICB2bS5fcHJveHkoa2V5KTtcbiAgICAgIHZtLl9kaWdlc3QoKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHZhbDtcbn1cblxuLyoqXG4gKiBEZWxldGUgYSBwcm9wZXJ0eSBhbmQgdHJpZ2dlciBjaGFuZ2UgaWYgbmVjZXNzYXJ5LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcbiAqIEBwYXJhbSB7U3RyaW5nfSBrZXlcbiAqL1xuXG5mdW5jdGlvbiBkZWwob2JqLCBrZXkpIHtcbiAgaWYgKCFoYXNPd24ob2JqLCBrZXkpKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGRlbGV0ZSBvYmpba2V5XTtcbiAgdmFyIG9iID0gb2JqLl9fb2JfXztcbiAgaWYgKCFvYikge1xuICAgIHJldHVybjtcbiAgfVxuICBvYi5kZXAubm90aWZ5KCk7XG4gIGlmIChvYi52bXMpIHtcbiAgICB2YXIgaSA9IG9iLnZtcy5sZW5ndGg7XG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgdmFyIHZtID0gb2Iudm1zW2ldO1xuICAgICAgdm0uX3VucHJveHkoa2V5KTtcbiAgICAgIHZtLl9kaWdlc3QoKTtcbiAgICB9XG4gIH1cbn1cblxudmFyIGhhc093blByb3BlcnR5ID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcbi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgb2JqZWN0IGhhcyB0aGUgcHJvcGVydHkuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9ialxuICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqL1xuXG5mdW5jdGlvbiBoYXNPd24ob2JqLCBrZXkpIHtcbiAgcmV0dXJuIGhhc093blByb3BlcnR5LmNhbGwob2JqLCBrZXkpO1xufVxuXG4vKipcbiAqIENoZWNrIGlmIGFuIGV4cHJlc3Npb24gaXMgYSBsaXRlcmFsIHZhbHVlLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBleHBcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cblxudmFyIGxpdGVyYWxWYWx1ZVJFID0gL15cXHM/KHRydWV8ZmFsc2V8W1xcZFxcLl0rfCdbXiddKid8XCJbXlwiXSpcIilcXHM/JC87XG5cbmZ1bmN0aW9uIGlzTGl0ZXJhbChleHApIHtcbiAgcmV0dXJuIGxpdGVyYWxWYWx1ZVJFLnRlc3QoZXhwKTtcbn1cblxuLyoqXG4gKiBDaGVjayBpZiBhIHN0cmluZyBzdGFydHMgd2l0aCAkIG9yIF9cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICovXG5cbmZ1bmN0aW9uIGlzUmVzZXJ2ZWQoc3RyKSB7XG4gIHZhciBjID0gKHN0ciArICcnKS5jaGFyQ29kZUF0KDApO1xuICByZXR1cm4gYyA9PT0gMHgyNCB8fCBjID09PSAweDVGO1xufVxuXG4vKipcbiAqIEd1YXJkIHRleHQgb3V0cHV0LCBtYWtlIHN1cmUgdW5kZWZpbmVkIG91dHB1dHNcbiAqIGVtcHR5IHN0cmluZ1xuICpcbiAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqL1xuXG5mdW5jdGlvbiBfdG9TdHJpbmcodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlID09IG51bGwgPyAnJyA6IHZhbHVlLnRvU3RyaW5nKCk7XG59XG5cbi8qKlxuICogQ2hlY2sgYW5kIGNvbnZlcnQgcG9zc2libGUgbnVtZXJpYyBzdHJpbmdzIHRvIG51bWJlcnNcbiAqIGJlZm9yZSBzZXR0aW5nIGJhY2sgdG8gZGF0YVxuICpcbiAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAqIEByZXR1cm4geyp8TnVtYmVyfVxuICovXG5cbmZ1bmN0aW9uIHRvTnVtYmVyKHZhbHVlKSB7XG4gIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9IGVsc2Uge1xuICAgIHZhciBwYXJzZWQgPSBOdW1iZXIodmFsdWUpO1xuICAgIHJldHVybiBpc05hTihwYXJzZWQpID8gdmFsdWUgOiBwYXJzZWQ7XG4gIH1cbn1cblxuLyoqXG4gKiBDb252ZXJ0IHN0cmluZyBib29sZWFuIGxpdGVyYWxzIGludG8gcmVhbCBib29sZWFucy5cbiAqXG4gKiBAcGFyYW0geyp9IHZhbHVlXG4gKiBAcmV0dXJuIHsqfEJvb2xlYW59XG4gKi9cblxuZnVuY3Rpb24gdG9Cb29sZWFuKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSA9PT0gJ3RydWUnID8gdHJ1ZSA6IHZhbHVlID09PSAnZmFsc2UnID8gZmFsc2UgOiB2YWx1ZTtcbn1cblxuLyoqXG4gKiBTdHJpcCBxdW90ZXMgZnJvbSBhIHN0cmluZ1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcbiAqIEByZXR1cm4ge1N0cmluZyB8IGZhbHNlfVxuICovXG5cbmZ1bmN0aW9uIHN0cmlwUXVvdGVzKHN0cikge1xuICB2YXIgYSA9IHN0ci5jaGFyQ29kZUF0KDApO1xuICB2YXIgYiA9IHN0ci5jaGFyQ29kZUF0KHN0ci5sZW5ndGggLSAxKTtcbiAgcmV0dXJuIGEgPT09IGIgJiYgKGEgPT09IDB4MjIgfHwgYSA9PT0gMHgyNykgPyBzdHIuc2xpY2UoMSwgLTEpIDogc3RyO1xufVxuXG4vKipcbiAqIENhbWVsaXplIGEgaHlwaGVuLWRlbG1pdGVkIHN0cmluZy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cblxudmFyIGNhbWVsaXplUkUgPSAvLShcXHcpL2c7XG5cbmZ1bmN0aW9uIGNhbWVsaXplKHN0cikge1xuICByZXR1cm4gc3RyLnJlcGxhY2UoY2FtZWxpemVSRSwgdG9VcHBlcik7XG59XG5cbmZ1bmN0aW9uIHRvVXBwZXIoXywgYykge1xuICByZXR1cm4gYyA/IGMudG9VcHBlckNhc2UoKSA6ICcnO1xufVxuXG4vKipcbiAqIEh5cGhlbmF0ZSBhIGNhbWVsQ2FzZSBzdHJpbmcuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5cbnZhciBoeXBoZW5hdGVSRSA9IC8oW2EtelxcZF0pKFtBLVpdKS9nO1xuXG5mdW5jdGlvbiBoeXBoZW5hdGUoc3RyKSB7XG4gIHJldHVybiBzdHIucmVwbGFjZShoeXBoZW5hdGVSRSwgJyQxLSQyJykudG9Mb3dlckNhc2UoKTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBoeXBoZW4vdW5kZXJzY29yZS9zbGFzaCBkZWxpbWl0ZXJlZCBuYW1lcyBpbnRvXG4gKiBjYW1lbGl6ZWQgY2xhc3NOYW1lcy5cbiAqXG4gKiBlLmcuIG15LWNvbXBvbmVudCA9PiBNeUNvbXBvbmVudFxuICogICAgICBzb21lX2Vsc2UgICAgPT4gU29tZUVsc2VcbiAqICAgICAgc29tZS9jb21wICAgID0+IFNvbWVDb21wXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5cbnZhciBjbGFzc2lmeVJFID0gLyg/Ol58Wy1fXFwvXSkoXFx3KS9nO1xuXG5mdW5jdGlvbiBjbGFzc2lmeShzdHIpIHtcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKGNsYXNzaWZ5UkUsIHRvVXBwZXIpO1xufVxuXG4vKipcbiAqIFNpbXBsZSBiaW5kLCBmYXN0ZXIgdGhhbiBuYXRpdmVcbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxuICogQHBhcmFtIHtPYmplY3R9IGN0eFxuICogQHJldHVybiB7RnVuY3Rpb259XG4gKi9cblxuZnVuY3Rpb24gYmluZCQxKGZuLCBjdHgpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChhKSB7XG4gICAgdmFyIGwgPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIHJldHVybiBsID8gbCA+IDEgPyBmbi5hcHBseShjdHgsIGFyZ3VtZW50cykgOiBmbi5jYWxsKGN0eCwgYSkgOiBmbi5jYWxsKGN0eCk7XG4gIH07XG59XG5cbi8qKlxuICogQ29udmVydCBhbiBBcnJheS1saWtlIG9iamVjdCB0byBhIHJlYWwgQXJyYXkuXG4gKlxuICogQHBhcmFtIHtBcnJheS1saWtlfSBsaXN0XG4gKiBAcGFyYW0ge051bWJlcn0gW3N0YXJ0XSAtIHN0YXJ0IGluZGV4XG4gKiBAcmV0dXJuIHtBcnJheX1cbiAqL1xuXG5mdW5jdGlvbiB0b0FycmF5KGxpc3QsIHN0YXJ0KSB7XG4gIHN0YXJ0ID0gc3RhcnQgfHwgMDtcbiAgdmFyIGkgPSBsaXN0Lmxlbmd0aCAtIHN0YXJ0O1xuICB2YXIgcmV0ID0gbmV3IEFycmF5KGkpO1xuICB3aGlsZSAoaS0tKSB7XG4gICAgcmV0W2ldID0gbGlzdFtpICsgc3RhcnRdO1xuICB9XG4gIHJldHVybiByZXQ7XG59XG5cbi8qKlxuICogTWl4IHByb3BlcnRpZXMgaW50byB0YXJnZXQgb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB0b1xuICogQHBhcmFtIHtPYmplY3R9IGZyb21cbiAqL1xuXG5mdW5jdGlvbiBleHRlbmQodG8sIGZyb20pIHtcbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhmcm9tKTtcbiAgdmFyIGkgPSBrZXlzLmxlbmd0aDtcbiAgd2hpbGUgKGktLSkge1xuICAgIHRvW2tleXNbaV1dID0gZnJvbVtrZXlzW2ldXTtcbiAgfVxuICByZXR1cm4gdG87XG59XG5cbi8qKlxuICogUXVpY2sgb2JqZWN0IGNoZWNrIC0gdGhpcyBpcyBwcmltYXJpbHkgdXNlZCB0byB0ZWxsXG4gKiBPYmplY3RzIGZyb20gcHJpbWl0aXZlIHZhbHVlcyB3aGVuIHdlIGtub3cgdGhlIHZhbHVlXG4gKiBpcyBhIEpTT04tY29tcGxpYW50IHR5cGUuXG4gKlxuICogQHBhcmFtIHsqfSBvYmpcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cblxuZnVuY3Rpb24gaXNPYmplY3Qob2JqKSB7XG4gIHJldHVybiBvYmogIT09IG51bGwgJiYgdHlwZW9mIG9iaiA9PT0gJ29iamVjdCc7XG59XG5cbi8qKlxuICogU3RyaWN0IG9iamVjdCB0eXBlIGNoZWNrLiBPbmx5IHJldHVybnMgdHJ1ZVxuICogZm9yIHBsYWluIEphdmFTY3JpcHQgb2JqZWN0cy5cbiAqXG4gKiBAcGFyYW0geyp9IG9ialxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqL1xuXG52YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xudmFyIE9CSkVDVF9TVFJJTkcgPSAnW29iamVjdCBPYmplY3RdJztcblxuZnVuY3Rpb24gaXNQbGFpbk9iamVjdChvYmopIHtcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwob2JqKSA9PT0gT0JKRUNUX1NUUklORztcbn1cblxuLyoqXG4gKiBBcnJheSB0eXBlIGNoZWNrLlxuICpcbiAqIEBwYXJhbSB7Kn0gb2JqXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICovXG5cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheTtcblxuLyoqXG4gKiBEZWZpbmUgYSBub24tZW51bWVyYWJsZSBwcm9wZXJ0eVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcbiAqIEBwYXJhbSB7U3RyaW5nfSBrZXlcbiAqIEBwYXJhbSB7Kn0gdmFsXG4gKiBAcGFyYW0ge0Jvb2xlYW59IFtlbnVtZXJhYmxlXVxuICovXG5cbmZ1bmN0aW9uIGRlZihvYmosIGtleSwgdmFsLCBlbnVtZXJhYmxlKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIGtleSwge1xuICAgIHZhbHVlOiB2YWwsXG4gICAgZW51bWVyYWJsZTogISFlbnVtZXJhYmxlLFxuICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICB9KTtcbn1cblxuLyoqXG4gKiBEZWJvdW5jZSBhIGZ1bmN0aW9uIHNvIGl0IG9ubHkgZ2V0cyBjYWxsZWQgYWZ0ZXIgdGhlXG4gKiBpbnB1dCBzdG9wcyBhcnJpdmluZyBhZnRlciB0aGUgZ2l2ZW4gd2FpdCBwZXJpb2QuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuY1xuICogQHBhcmFtIHtOdW1iZXJ9IHdhaXRcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufSAtIHRoZSBkZWJvdW5jZWQgZnVuY3Rpb25cbiAqL1xuXG5mdW5jdGlvbiBfZGVib3VuY2UoZnVuYywgd2FpdCkge1xuICB2YXIgdGltZW91dCwgYXJncywgY29udGV4dCwgdGltZXN0YW1wLCByZXN1bHQ7XG4gIHZhciBsYXRlciA9IGZ1bmN0aW9uIGxhdGVyKCkge1xuICAgIHZhciBsYXN0ID0gRGF0ZS5ub3coKSAtIHRpbWVzdGFtcDtcbiAgICBpZiAobGFzdCA8IHdhaXQgJiYgbGFzdCA+PSAwKSB7XG4gICAgICB0aW1lb3V0ID0gc2V0VGltZW91dChsYXRlciwgd2FpdCAtIGxhc3QpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICBpZiAoIXRpbWVvdXQpIGNvbnRleHQgPSBhcmdzID0gbnVsbDtcbiAgICB9XG4gIH07XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgY29udGV4dCA9IHRoaXM7XG4gICAgYXJncyA9IGFyZ3VtZW50cztcbiAgICB0aW1lc3RhbXAgPSBEYXRlLm5vdygpO1xuICAgIGlmICghdGltZW91dCkge1xuICAgICAgdGltZW91dCA9IHNldFRpbWVvdXQobGF0ZXIsIHdhaXQpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xufVxuXG4vKipcbiAqIE1hbnVhbCBpbmRleE9mIGJlY2F1c2UgaXQncyBzbGlnaHRseSBmYXN0ZXIgdGhhblxuICogbmF0aXZlLlxuICpcbiAqIEBwYXJhbSB7QXJyYXl9IGFyclxuICogQHBhcmFtIHsqfSBvYmpcbiAqL1xuXG5mdW5jdGlvbiBpbmRleE9mKGFyciwgb2JqKSB7XG4gIHZhciBpID0gYXJyLmxlbmd0aDtcbiAgd2hpbGUgKGktLSkge1xuICAgIGlmIChhcnJbaV0gPT09IG9iaikgcmV0dXJuIGk7XG4gIH1cbiAgcmV0dXJuIC0xO1xufVxuXG4vKipcbiAqIE1ha2UgYSBjYW5jZWxsYWJsZSB2ZXJzaW9uIG9mIGFuIGFzeW5jIGNhbGxiYWNrLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqL1xuXG5mdW5jdGlvbiBjYW5jZWxsYWJsZShmbikge1xuICB2YXIgY2IgPSBmdW5jdGlvbiBjYigpIHtcbiAgICBpZiAoIWNiLmNhbmNlbGxlZCkge1xuICAgICAgcmV0dXJuIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9O1xuICBjYi5jYW5jZWwgPSBmdW5jdGlvbiAoKSB7XG4gICAgY2IuY2FuY2VsbGVkID0gdHJ1ZTtcbiAgfTtcbiAgcmV0dXJuIGNiO1xufVxuXG4vKipcbiAqIENoZWNrIGlmIHR3byB2YWx1ZXMgYXJlIGxvb3NlbHkgZXF1YWwgLSB0aGF0IGlzLFxuICogaWYgdGhleSBhcmUgcGxhaW4gb2JqZWN0cywgZG8gdGhleSBoYXZlIHRoZSBzYW1lIHNoYXBlP1xuICpcbiAqIEBwYXJhbSB7Kn0gYVxuICogQHBhcmFtIHsqfSBiXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICovXG5cbmZ1bmN0aW9uIGxvb3NlRXF1YWwoYSwgYikge1xuICAvKiBlc2xpbnQtZGlzYWJsZSBlcWVxZXEgKi9cbiAgcmV0dXJuIGEgPT0gYiB8fCAoaXNPYmplY3QoYSkgJiYgaXNPYmplY3QoYikgPyBKU09OLnN0cmluZ2lmeShhKSA9PT0gSlNPTi5zdHJpbmdpZnkoYikgOiBmYWxzZSk7XG4gIC8qIGVzbGludC1lbmFibGUgZXFlcWVxICovXG59XG5cbnZhciBoYXNQcm90byA9ICgnX19wcm90b19fJyBpbiB7fSk7XG5cbi8vIEJyb3dzZXIgZW52aXJvbm1lbnQgc25pZmZpbmdcbnZhciBpbkJyb3dzZXIgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwod2luZG93KSAhPT0gJ1tvYmplY3QgT2JqZWN0XSc7XG5cbnZhciBpc0lFOSA9IGluQnJvd3NlciAmJiBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkuaW5kZXhPZignbXNpZSA5LjAnKSA+IDA7XG5cbnZhciBpc0FuZHJvaWQgPSBpbkJyb3dzZXIgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2FuZHJvaWQnKSA+IDA7XG5cbnZhciB0cmFuc2l0aW9uUHJvcCA9IHVuZGVmaW5lZDtcbnZhciB0cmFuc2l0aW9uRW5kRXZlbnQgPSB1bmRlZmluZWQ7XG52YXIgYW5pbWF0aW9uUHJvcCA9IHVuZGVmaW5lZDtcbnZhciBhbmltYXRpb25FbmRFdmVudCA9IHVuZGVmaW5lZDtcblxuLy8gVHJhbnNpdGlvbiBwcm9wZXJ0eS9ldmVudCBzbmlmZmluZ1xuaWYgKGluQnJvd3NlciAmJiAhaXNJRTkpIHtcbiAgdmFyIGlzV2Via2l0VHJhbnMgPSB3aW5kb3cub250cmFuc2l0aW9uZW5kID09PSB1bmRlZmluZWQgJiYgd2luZG93Lm9ud2Via2l0dHJhbnNpdGlvbmVuZCAhPT0gdW5kZWZpbmVkO1xuICB2YXIgaXNXZWJraXRBbmltID0gd2luZG93Lm9uYW5pbWF0aW9uZW5kID09PSB1bmRlZmluZWQgJiYgd2luZG93Lm9ud2Via2l0YW5pbWF0aW9uZW5kICE9PSB1bmRlZmluZWQ7XG4gIHRyYW5zaXRpb25Qcm9wID0gaXNXZWJraXRUcmFucyA/ICdXZWJraXRUcmFuc2l0aW9uJyA6ICd0cmFuc2l0aW9uJztcbiAgdHJhbnNpdGlvbkVuZEV2ZW50ID0gaXNXZWJraXRUcmFucyA/ICd3ZWJraXRUcmFuc2l0aW9uRW5kJyA6ICd0cmFuc2l0aW9uZW5kJztcbiAgYW5pbWF0aW9uUHJvcCA9IGlzV2Via2l0QW5pbSA/ICdXZWJraXRBbmltYXRpb24nIDogJ2FuaW1hdGlvbic7XG4gIGFuaW1hdGlvbkVuZEV2ZW50ID0gaXNXZWJraXRBbmltID8gJ3dlYmtpdEFuaW1hdGlvbkVuZCcgOiAnYW5pbWF0aW9uZW5kJztcbn1cblxuLyoqXG4gKiBEZWZlciBhIHRhc2sgdG8gZXhlY3V0ZSBpdCBhc3luY2hyb25vdXNseS4gSWRlYWxseSB0aGlzXG4gKiBzaG91bGQgYmUgZXhlY3V0ZWQgYXMgYSBtaWNyb3Rhc2ssIHNvIHdlIGxldmVyYWdlXG4gKiBNdXRhdGlvbk9ic2VydmVyIGlmIGl0J3MgYXZhaWxhYmxlLCBhbmQgZmFsbGJhY2sgdG9cbiAqIHNldFRpbWVvdXQoMCkuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2JcbiAqIEBwYXJhbSB7T2JqZWN0fSBjdHhcbiAqL1xuXG52YXIgbmV4dFRpY2sgPSAoZnVuY3Rpb24gKCkge1xuICB2YXIgY2FsbGJhY2tzID0gW107XG4gIHZhciBwZW5kaW5nID0gZmFsc2U7XG4gIHZhciB0aW1lckZ1bmM7XG4gIGZ1bmN0aW9uIG5leHRUaWNrSGFuZGxlcigpIHtcbiAgICBwZW5kaW5nID0gZmFsc2U7XG4gICAgdmFyIGNvcGllcyA9IGNhbGxiYWNrcy5zbGljZSgwKTtcbiAgICBjYWxsYmFja3MgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvcGllcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29waWVzW2ldKCk7XG4gICAgfVxuICB9XG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICBpZiAodHlwZW9mIE11dGF0aW9uT2JzZXJ2ZXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgdmFyIGNvdW50ZXIgPSAxO1xuICAgIHZhciBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKG5leHRUaWNrSGFuZGxlcik7XG4gICAgdmFyIHRleHROb2RlID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY291bnRlcik7XG4gICAgb2JzZXJ2ZXIub2JzZXJ2ZSh0ZXh0Tm9kZSwge1xuICAgICAgY2hhcmFjdGVyRGF0YTogdHJ1ZVxuICAgIH0pO1xuICAgIHRpbWVyRnVuYyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIGNvdW50ZXIgPSAoY291bnRlciArIDEpICUgMjtcbiAgICAgIHRleHROb2RlLmRhdGEgPSBjb3VudGVyO1xuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgdGltZXJGdW5jID0gc2V0VGltZW91dDtcbiAgfVxuICByZXR1cm4gZnVuY3Rpb24gKGNiLCBjdHgpIHtcbiAgICB2YXIgZnVuYyA9IGN0eCA/IGZ1bmN0aW9uICgpIHtcbiAgICAgIGNiLmNhbGwoY3R4KTtcbiAgICB9IDogY2I7XG4gICAgY2FsbGJhY2tzLnB1c2goZnVuYyk7XG4gICAgaWYgKHBlbmRpbmcpIHJldHVybjtcbiAgICBwZW5kaW5nID0gdHJ1ZTtcbiAgICB0aW1lckZ1bmMobmV4dFRpY2tIYW5kbGVyLCAwKTtcbiAgfTtcbn0pKCk7XG5cbmZ1bmN0aW9uIENhY2hlKGxpbWl0KSB7XG4gIHRoaXMuc2l6ZSA9IDA7XG4gIHRoaXMubGltaXQgPSBsaW1pdDtcbiAgdGhpcy5oZWFkID0gdGhpcy50YWlsID0gdW5kZWZpbmVkO1xuICB0aGlzLl9rZXltYXAgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xufVxuXG52YXIgcCA9IENhY2hlLnByb3RvdHlwZTtcblxuLyoqXG4gKiBQdXQgPHZhbHVlPiBpbnRvIHRoZSBjYWNoZSBhc3NvY2lhdGVkIHdpdGggPGtleT4uXG4gKiBSZXR1cm5zIHRoZSBlbnRyeSB3aGljaCB3YXMgcmVtb3ZlZCB0byBtYWtlIHJvb20gZm9yXG4gKiB0aGUgbmV3IGVudHJ5LiBPdGhlcndpc2UgdW5kZWZpbmVkIGlzIHJldHVybmVkLlxuICogKGkuZS4gaWYgdGhlcmUgd2FzIGVub3VnaCByb29tIGFscmVhZHkpLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBrZXlcbiAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAqIEByZXR1cm4ge0VudHJ5fHVuZGVmaW5lZH1cbiAqL1xuXG5wLnB1dCA9IGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XG4gIHZhciBlbnRyeSA9IHtcbiAgICBrZXk6IGtleSxcbiAgICB2YWx1ZTogdmFsdWVcbiAgfTtcbiAgdGhpcy5fa2V5bWFwW2tleV0gPSBlbnRyeTtcbiAgaWYgKHRoaXMudGFpbCkge1xuICAgIHRoaXMudGFpbC5uZXdlciA9IGVudHJ5O1xuICAgIGVudHJ5Lm9sZGVyID0gdGhpcy50YWlsO1xuICB9IGVsc2Uge1xuICAgIHRoaXMuaGVhZCA9IGVudHJ5O1xuICB9XG4gIHRoaXMudGFpbCA9IGVudHJ5O1xuICBpZiAodGhpcy5zaXplID09PSB0aGlzLmxpbWl0KSB7XG4gICAgcmV0dXJuIHRoaXMuc2hpZnQoKTtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLnNpemUrKztcbiAgfVxufTtcblxuLyoqXG4gKiBQdXJnZSB0aGUgbGVhc3QgcmVjZW50bHkgdXNlZCAob2xkZXN0KSBlbnRyeSBmcm9tIHRoZVxuICogY2FjaGUuIFJldHVybnMgdGhlIHJlbW92ZWQgZW50cnkgb3IgdW5kZWZpbmVkIGlmIHRoZVxuICogY2FjaGUgd2FzIGVtcHR5LlxuICovXG5cbnAuc2hpZnQgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBlbnRyeSA9IHRoaXMuaGVhZDtcbiAgaWYgKGVudHJ5KSB7XG4gICAgdGhpcy5oZWFkID0gdGhpcy5oZWFkLm5ld2VyO1xuICAgIHRoaXMuaGVhZC5vbGRlciA9IHVuZGVmaW5lZDtcbiAgICBlbnRyeS5uZXdlciA9IGVudHJ5Lm9sZGVyID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuX2tleW1hcFtlbnRyeS5rZXldID0gdW5kZWZpbmVkO1xuICB9XG4gIHJldHVybiBlbnRyeTtcbn07XG5cbi8qKlxuICogR2V0IGFuZCByZWdpc3RlciByZWNlbnQgdXNlIG9mIDxrZXk+LiBSZXR1cm5zIHRoZSB2YWx1ZVxuICogYXNzb2NpYXRlZCB3aXRoIDxrZXk+IG9yIHVuZGVmaW5lZCBpZiBub3QgaW4gY2FjaGUuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICogQHBhcmFtIHtCb29sZWFufSByZXR1cm5FbnRyeVxuICogQHJldHVybiB7RW50cnl8Kn1cbiAqL1xuXG5wLmdldCA9IGZ1bmN0aW9uIChrZXksIHJldHVybkVudHJ5KSB7XG4gIHZhciBlbnRyeSA9IHRoaXMuX2tleW1hcFtrZXldO1xuICBpZiAoZW50cnkgPT09IHVuZGVmaW5lZCkgcmV0dXJuO1xuICBpZiAoZW50cnkgPT09IHRoaXMudGFpbCkge1xuICAgIHJldHVybiByZXR1cm5FbnRyeSA/IGVudHJ5IDogZW50cnkudmFsdWU7XG4gIH1cbiAgLy8gSEVBRC0tLS0tLS0tLS0tLS0tVEFJTFxuICAvLyAgIDwub2xkZXIgICAubmV3ZXI+XG4gIC8vICA8LS0tIGFkZCBkaXJlY3Rpb24gLS1cbiAgLy8gICBBICBCICBDICA8RD4gIEVcbiAgaWYgKGVudHJ5Lm5ld2VyKSB7XG4gICAgaWYgKGVudHJ5ID09PSB0aGlzLmhlYWQpIHtcbiAgICAgIHRoaXMuaGVhZCA9IGVudHJ5Lm5ld2VyO1xuICAgIH1cbiAgICBlbnRyeS5uZXdlci5vbGRlciA9IGVudHJ5Lm9sZGVyOyAvLyBDIDwtLSBFLlxuICB9XG4gIGlmIChlbnRyeS5vbGRlcikge1xuICAgIGVudHJ5Lm9sZGVyLm5ld2VyID0gZW50cnkubmV3ZXI7IC8vIEMuIC0tPiBFXG4gIH1cbiAgZW50cnkubmV3ZXIgPSB1bmRlZmluZWQ7IC8vIEQgLS14XG4gIGVudHJ5Lm9sZGVyID0gdGhpcy50YWlsOyAvLyBELiAtLT4gRVxuICBpZiAodGhpcy50YWlsKSB7XG4gICAgdGhpcy50YWlsLm5ld2VyID0gZW50cnk7IC8vIEUuIDwtLSBEXG4gIH1cbiAgdGhpcy50YWlsID0gZW50cnk7XG4gIHJldHVybiByZXR1cm5FbnRyeSA/IGVudHJ5IDogZW50cnkudmFsdWU7XG59O1xuXG52YXIgY2FjaGUkMSA9IG5ldyBDYWNoZSgxMDAwKTtcbnZhciBmaWx0ZXJUb2tlblJFID0gL1teXFxzJ1wiXSt8J1teJ10qJ3xcIlteXCJdKlwiL2c7XG52YXIgcmVzZXJ2ZWRBcmdSRSA9IC9eaW4kfF4tP1xcZCsvO1xuXG4vKipcbiAqIFBhcnNlciBzdGF0ZVxuICovXG5cbnZhciBzdHI7XG52YXIgZGlyO1xudmFyIGM7XG52YXIgcHJldjtcbnZhciBpO1xudmFyIGw7XG52YXIgbGFzdEZpbHRlckluZGV4O1xudmFyIGluU2luZ2xlO1xudmFyIGluRG91YmxlO1xudmFyIGN1cmx5O1xudmFyIHNxdWFyZTtcbnZhciBwYXJlbjtcbi8qKlxuICogUHVzaCBhIGZpbHRlciB0byB0aGUgY3VycmVudCBkaXJlY3RpdmUgb2JqZWN0XG4gKi9cblxuZnVuY3Rpb24gcHVzaEZpbHRlcigpIHtcbiAgdmFyIGV4cCA9IHN0ci5zbGljZShsYXN0RmlsdGVySW5kZXgsIGkpLnRyaW0oKTtcbiAgdmFyIGZpbHRlcjtcbiAgaWYgKGV4cCkge1xuICAgIGZpbHRlciA9IHt9O1xuICAgIHZhciB0b2tlbnMgPSBleHAubWF0Y2goZmlsdGVyVG9rZW5SRSk7XG4gICAgZmlsdGVyLm5hbWUgPSB0b2tlbnNbMF07XG4gICAgaWYgKHRva2Vucy5sZW5ndGggPiAxKSB7XG4gICAgICBmaWx0ZXIuYXJncyA9IHRva2Vucy5zbGljZSgxKS5tYXAocHJvY2Vzc0ZpbHRlckFyZyk7XG4gICAgfVxuICB9XG4gIGlmIChmaWx0ZXIpIHtcbiAgICAoZGlyLmZpbHRlcnMgPSBkaXIuZmlsdGVycyB8fCBbXSkucHVzaChmaWx0ZXIpO1xuICB9XG4gIGxhc3RGaWx0ZXJJbmRleCA9IGkgKyAxO1xufVxuXG4vKipcbiAqIENoZWNrIGlmIGFuIGFyZ3VtZW50IGlzIGR5bmFtaWMgYW5kIHN0cmlwIHF1b3Rlcy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gYXJnXG4gKiBAcmV0dXJuIHtPYmplY3R9XG4gKi9cblxuZnVuY3Rpb24gcHJvY2Vzc0ZpbHRlckFyZyhhcmcpIHtcbiAgaWYgKHJlc2VydmVkQXJnUkUudGVzdChhcmcpKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHZhbHVlOiB0b051bWJlcihhcmcpLFxuICAgICAgZHluYW1pYzogZmFsc2VcbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIHZhciBzdHJpcHBlZCA9IHN0cmlwUXVvdGVzKGFyZyk7XG4gICAgdmFyIGR5bmFtaWMgPSBzdHJpcHBlZCA9PT0gYXJnO1xuICAgIHJldHVybiB7XG4gICAgICB2YWx1ZTogZHluYW1pYyA/IGFyZyA6IHN0cmlwcGVkLFxuICAgICAgZHluYW1pYzogZHluYW1pY1xuICAgIH07XG4gIH1cbn1cblxuLyoqXG4gKiBQYXJzZSBhIGRpcmVjdGl2ZSB2YWx1ZSBhbmQgZXh0cmFjdCB0aGUgZXhwcmVzc2lvblxuICogYW5kIGl0cyBmaWx0ZXJzIGludG8gYSBkZXNjcmlwdG9yLlxuICpcbiAqIEV4YW1wbGU6XG4gKlxuICogXCJhICsgMSB8IHVwcGVyY2FzZVwiIHdpbGwgeWllbGQ6XG4gKiB7XG4gKiAgIGV4cHJlc3Npb246ICdhICsgMScsXG4gKiAgIGZpbHRlcnM6IFtcbiAqICAgICB7IG5hbWU6ICd1cHBlcmNhc2UnLCBhcmdzOiBudWxsIH1cbiAqICAgXVxuICogfVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcbiAqIEByZXR1cm4ge09iamVjdH1cbiAqL1xuXG5mdW5jdGlvbiBwYXJzZURpcmVjdGl2ZShzKSB7XG5cbiAgdmFyIGhpdCA9IGNhY2hlJDEuZ2V0KHMpO1xuICBpZiAoaGl0KSB7XG4gICAgcmV0dXJuIGhpdDtcbiAgfVxuXG4gIC8vIHJlc2V0IHBhcnNlciBzdGF0ZVxuICBzdHIgPSBzO1xuICBpblNpbmdsZSA9IGluRG91YmxlID0gZmFsc2U7XG4gIGN1cmx5ID0gc3F1YXJlID0gcGFyZW4gPSAwO1xuICBsYXN0RmlsdGVySW5kZXggPSAwO1xuICBkaXIgPSB7fTtcblxuICBmb3IgKGkgPSAwLCBsID0gc3RyLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIHByZXYgPSBjO1xuICAgIGMgPSBzdHIuY2hhckNvZGVBdChpKTtcbiAgICBpZiAoaW5TaW5nbGUpIHtcbiAgICAgIC8vIGNoZWNrIHNpbmdsZSBxdW90ZVxuICAgICAgaWYgKGMgPT09IDB4MjcgJiYgcHJldiAhPT0gMHg1QykgaW5TaW5nbGUgPSAhaW5TaW5nbGU7XG4gICAgfSBlbHNlIGlmIChpbkRvdWJsZSkge1xuICAgICAgLy8gY2hlY2sgZG91YmxlIHF1b3RlXG4gICAgICBpZiAoYyA9PT0gMHgyMiAmJiBwcmV2ICE9PSAweDVDKSBpbkRvdWJsZSA9ICFpbkRvdWJsZTtcbiAgICB9IGVsc2UgaWYgKGMgPT09IDB4N0MgJiYgLy8gcGlwZVxuICAgIHN0ci5jaGFyQ29kZUF0KGkgKyAxKSAhPT0gMHg3QyAmJiBzdHIuY2hhckNvZGVBdChpIC0gMSkgIT09IDB4N0MpIHtcbiAgICAgIGlmIChkaXIuZXhwcmVzc2lvbiA9PSBudWxsKSB7XG4gICAgICAgIC8vIGZpcnN0IGZpbHRlciwgZW5kIG9mIGV4cHJlc3Npb25cbiAgICAgICAgbGFzdEZpbHRlckluZGV4ID0gaSArIDE7XG4gICAgICAgIGRpci5leHByZXNzaW9uID0gc3RyLnNsaWNlKDAsIGkpLnRyaW0oKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGFscmVhZHkgaGFzIGZpbHRlclxuICAgICAgICBwdXNoRmlsdGVyKCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHN3aXRjaCAoYykge1xuICAgICAgICBjYXNlIDB4MjI6XG4gICAgICAgICAgaW5Eb3VibGUgPSB0cnVlO2JyZWFrOyAvLyBcIlxuICAgICAgICBjYXNlIDB4Mjc6XG4gICAgICAgICAgaW5TaW5nbGUgPSB0cnVlO2JyZWFrOyAvLyAnXG4gICAgICAgIGNhc2UgMHgyODpcbiAgICAgICAgICBwYXJlbisrO2JyZWFrOyAvLyAoXG4gICAgICAgIGNhc2UgMHgyOTpcbiAgICAgICAgICBwYXJlbi0tO2JyZWFrOyAvLyApXG4gICAgICAgIGNhc2UgMHg1QjpcbiAgICAgICAgICBzcXVhcmUrKzticmVhazsgLy8gW1xuICAgICAgICBjYXNlIDB4NUQ6XG4gICAgICAgICAgc3F1YXJlLS07YnJlYWs7IC8vIF1cbiAgICAgICAgY2FzZSAweDdCOlxuICAgICAgICAgIGN1cmx5Kys7YnJlYWs7IC8vIHtcbiAgICAgICAgY2FzZSAweDdEOlxuICAgICAgICAgIGN1cmx5LS07YnJlYWs7IC8vIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpZiAoZGlyLmV4cHJlc3Npb24gPT0gbnVsbCkge1xuICAgIGRpci5leHByZXNzaW9uID0gc3RyLnNsaWNlKDAsIGkpLnRyaW0oKTtcbiAgfSBlbHNlIGlmIChsYXN0RmlsdGVySW5kZXggIT09IDApIHtcbiAgICBwdXNoRmlsdGVyKCk7XG4gIH1cblxuICBjYWNoZSQxLnB1dChzLCBkaXIpO1xuICByZXR1cm4gZGlyO1xufVxuXG52YXIgZGlyZWN0aXZlID0gT2JqZWN0LmZyZWV6ZSh7XG4gIHBhcnNlRGlyZWN0aXZlOiBwYXJzZURpcmVjdGl2ZVxufSk7XG5cbnZhciByZWdleEVzY2FwZVJFID0gL1stLiorP14ke30oKXxbXFxdXFwvXFxcXF0vZztcbnZhciBjYWNoZSA9IHVuZGVmaW5lZDtcbnZhciB0YWdSRSA9IHVuZGVmaW5lZDtcbnZhciBodG1sUkUgPSB1bmRlZmluZWQ7XG4vKipcbiAqIEVzY2FwZSBhIHN0cmluZyBzbyBpdCBjYW4gYmUgdXNlZCBpbiBhIFJlZ0V4cFxuICogY29uc3RydWN0b3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICovXG5cbmZ1bmN0aW9uIGVzY2FwZVJlZ2V4KHN0cikge1xuICByZXR1cm4gc3RyLnJlcGxhY2UocmVnZXhFc2NhcGVSRSwgJ1xcXFwkJicpO1xufVxuXG5mdW5jdGlvbiBjb21waWxlUmVnZXgoKSB7XG4gIHZhciBvcGVuID0gZXNjYXBlUmVnZXgoY29uZmlnLmRlbGltaXRlcnNbMF0pO1xuICB2YXIgY2xvc2UgPSBlc2NhcGVSZWdleChjb25maWcuZGVsaW1pdGVyc1sxXSk7XG4gIHZhciB1bnNhZmVPcGVuID0gZXNjYXBlUmVnZXgoY29uZmlnLnVuc2FmZURlbGltaXRlcnNbMF0pO1xuICB2YXIgdW5zYWZlQ2xvc2UgPSBlc2NhcGVSZWdleChjb25maWcudW5zYWZlRGVsaW1pdGVyc1sxXSk7XG4gIHRhZ1JFID0gbmV3IFJlZ0V4cCh1bnNhZmVPcGVuICsgJyguKz8pJyArIHVuc2FmZUNsb3NlICsgJ3wnICsgb3BlbiArICcoLis/KScgKyBjbG9zZSwgJ2cnKTtcbiAgaHRtbFJFID0gbmV3IFJlZ0V4cCgnXicgKyB1bnNhZmVPcGVuICsgJy4qJyArIHVuc2FmZUNsb3NlICsgJyQnKTtcbiAgLy8gcmVzZXQgY2FjaGVcbiAgY2FjaGUgPSBuZXcgQ2FjaGUoMTAwMCk7XG59XG5cbi8qKlxuICogUGFyc2UgYSB0ZW1wbGF0ZSB0ZXh0IHN0cmluZyBpbnRvIGFuIGFycmF5IG9mIHRva2Vucy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdGV4dFxuICogQHJldHVybiB7QXJyYXk8T2JqZWN0PiB8IG51bGx9XG4gKiAgICAgICAgICAgICAgIC0ge1N0cmluZ30gdHlwZVxuICogICAgICAgICAgICAgICAtIHtTdHJpbmd9IHZhbHVlXG4gKiAgICAgICAgICAgICAgIC0ge0Jvb2xlYW59IFtodG1sXVxuICogICAgICAgICAgICAgICAtIHtCb29sZWFufSBbb25lVGltZV1cbiAqL1xuXG5mdW5jdGlvbiBwYXJzZVRleHQodGV4dCkge1xuICBpZiAoIWNhY2hlKSB7XG4gICAgY29tcGlsZVJlZ2V4KCk7XG4gIH1cbiAgdmFyIGhpdCA9IGNhY2hlLmdldCh0ZXh0KTtcbiAgaWYgKGhpdCkge1xuICAgIHJldHVybiBoaXQ7XG4gIH1cbiAgdGV4dCA9IHRleHQucmVwbGFjZSgvXFxuL2csICcnKTtcbiAgaWYgKCF0YWdSRS50ZXN0KHRleHQpKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmFyIHRva2VucyA9IFtdO1xuICB2YXIgbGFzdEluZGV4ID0gdGFnUkUubGFzdEluZGV4ID0gMDtcbiAgdmFyIG1hdGNoLCBpbmRleCwgaHRtbCwgdmFsdWUsIGZpcnN0LCBvbmVUaW1lO1xuICAvKiBlc2xpbnQtZGlzYWJsZSBuby1jb25kLWFzc2lnbiAqL1xuICB3aGlsZSAobWF0Y2ggPSB0YWdSRS5leGVjKHRleHQpKSB7XG4gICAgLyogZXNsaW50LWVuYWJsZSBuby1jb25kLWFzc2lnbiAqL1xuICAgIGluZGV4ID0gbWF0Y2guaW5kZXg7XG4gICAgLy8gcHVzaCB0ZXh0IHRva2VuXG4gICAgaWYgKGluZGV4ID4gbGFzdEluZGV4KSB7XG4gICAgICB0b2tlbnMucHVzaCh7XG4gICAgICAgIHZhbHVlOiB0ZXh0LnNsaWNlKGxhc3RJbmRleCwgaW5kZXgpXG4gICAgICB9KTtcbiAgICB9XG4gICAgLy8gdGFnIHRva2VuXG4gICAgaHRtbCA9IGh0bWxSRS50ZXN0KG1hdGNoWzBdKTtcbiAgICB2YWx1ZSA9IGh0bWwgPyBtYXRjaFsxXSA6IG1hdGNoWzJdO1xuICAgIGZpcnN0ID0gdmFsdWUuY2hhckNvZGVBdCgwKTtcbiAgICBvbmVUaW1lID0gZmlyc3QgPT09IDQyOyAvLyAqXG4gICAgdmFsdWUgPSBvbmVUaW1lID8gdmFsdWUuc2xpY2UoMSkgOiB2YWx1ZTtcbiAgICB0b2tlbnMucHVzaCh7XG4gICAgICB0YWc6IHRydWUsXG4gICAgICB2YWx1ZTogdmFsdWUudHJpbSgpLFxuICAgICAgaHRtbDogaHRtbCxcbiAgICAgIG9uZVRpbWU6IG9uZVRpbWVcbiAgICB9KTtcbiAgICBsYXN0SW5kZXggPSBpbmRleCArIG1hdGNoWzBdLmxlbmd0aDtcbiAgfVxuICBpZiAobGFzdEluZGV4IDwgdGV4dC5sZW5ndGgpIHtcbiAgICB0b2tlbnMucHVzaCh7XG4gICAgICB2YWx1ZTogdGV4dC5zbGljZShsYXN0SW5kZXgpXG4gICAgfSk7XG4gIH1cbiAgY2FjaGUucHV0KHRleHQsIHRva2Vucyk7XG4gIHJldHVybiB0b2tlbnM7XG59XG5cbi8qKlxuICogRm9ybWF0IGEgbGlzdCBvZiB0b2tlbnMgaW50byBhbiBleHByZXNzaW9uLlxuICogZS5nLiB0b2tlbnMgcGFyc2VkIGZyb20gJ2Ege3tifX0gYycgY2FuIGJlIHNlcmlhbGl6ZWRcbiAqIGludG8gb25lIHNpbmdsZSBleHByZXNzaW9uIGFzICdcImEgXCIgKyBiICsgXCIgY1wiJy5cbiAqXG4gKiBAcGFyYW0ge0FycmF5fSB0b2tlbnNcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqL1xuXG5mdW5jdGlvbiB0b2tlbnNUb0V4cCh0b2tlbnMpIHtcbiAgaWYgKHRva2Vucy5sZW5ndGggPiAxKSB7XG4gICAgcmV0dXJuIHRva2Vucy5tYXAoZnVuY3Rpb24gKHRva2VuKSB7XG4gICAgICByZXR1cm4gZm9ybWF0VG9rZW4odG9rZW4pO1xuICAgIH0pLmpvaW4oJysnKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZm9ybWF0VG9rZW4odG9rZW5zWzBdLCB0cnVlKTtcbiAgfVxufVxuXG4vKipcbiAqIEZvcm1hdCBhIHNpbmdsZSB0b2tlbi5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdG9rZW5cbiAqIEBwYXJhbSB7Qm9vbGVhbn0gc2luZ2xlXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cblxuZnVuY3Rpb24gZm9ybWF0VG9rZW4odG9rZW4sIHNpbmdsZSkge1xuICByZXR1cm4gdG9rZW4udGFnID8gaW5saW5lRmlsdGVycyh0b2tlbi52YWx1ZSwgc2luZ2xlKSA6ICdcIicgKyB0b2tlbi52YWx1ZSArICdcIic7XG59XG5cbi8qKlxuICogRm9yIGFuIGF0dHJpYnV0ZSB3aXRoIG11bHRpcGxlIGludGVycG9sYXRpb24gdGFncyxcbiAqIGUuZy4gYXR0cj1cInNvbWUte3t0aGluZyB8IGZpbHRlcn19XCIsIGluIG9yZGVyIHRvIGNvbWJpbmVcbiAqIHRoZSB3aG9sZSB0aGluZyBpbnRvIGEgc2luZ2xlIHdhdGNoYWJsZSBleHByZXNzaW9uLCB3ZVxuICogaGF2ZSB0byBpbmxpbmUgdGhvc2UgZmlsdGVycy4gVGhpcyBmdW5jdGlvbiBkb2VzIGV4YWN0bHlcbiAqIHRoYXQuIFRoaXMgaXMgYSBiaXQgaGFja3kgYnV0IGl0IGF2b2lkcyBoZWF2eSBjaGFuZ2VzXG4gKiB0byBkaXJlY3RpdmUgcGFyc2VyIGFuZCB3YXRjaGVyIG1lY2hhbmlzbS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZXhwXG4gKiBAcGFyYW0ge0Jvb2xlYW59IHNpbmdsZVxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5cbnZhciBmaWx0ZXJSRSQxID0gL1tefF1cXHxbXnxdLztcbmZ1bmN0aW9uIGlubGluZUZpbHRlcnMoZXhwLCBzaW5nbGUpIHtcbiAgaWYgKCFmaWx0ZXJSRSQxLnRlc3QoZXhwKSkge1xuICAgIHJldHVybiBzaW5nbGUgPyBleHAgOiAnKCcgKyBleHAgKyAnKSc7XG4gIH0gZWxzZSB7XG4gICAgdmFyIGRpciA9IHBhcnNlRGlyZWN0aXZlKGV4cCk7XG4gICAgaWYgKCFkaXIuZmlsdGVycykge1xuICAgICAgcmV0dXJuICcoJyArIGV4cCArICcpJztcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuICd0aGlzLl9hcHBseUZpbHRlcnMoJyArIGRpci5leHByZXNzaW9uICsgLy8gdmFsdWVcbiAgICAgICcsbnVsbCwnICsgLy8gb2xkVmFsdWUgKG51bGwgZm9yIHJlYWQpXG4gICAgICBKU09OLnN0cmluZ2lmeShkaXIuZmlsdGVycykgKyAvLyBmaWx0ZXIgZGVzY3JpcHRvcnNcbiAgICAgICcsZmFsc2UpJzsgLy8gd3JpdGU/XG4gICAgfVxuICB9XG59XG5cbnZhciB0ZXh0JDEgPSBPYmplY3QuZnJlZXplKHtcbiAgY29tcGlsZVJlZ2V4OiBjb21waWxlUmVnZXgsXG4gIHBhcnNlVGV4dDogcGFyc2VUZXh0LFxuICB0b2tlbnNUb0V4cDogdG9rZW5zVG9FeHBcbn0pO1xuXG52YXIgZGVsaW1pdGVycyA9IFsne3snLCAnfX0nXTtcbnZhciB1bnNhZmVEZWxpbWl0ZXJzID0gWyd7e3snLCAnfX19J107XG5cbnZhciBjb25maWcgPSBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh7XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdG8gcHJpbnQgZGVidWcgbWVzc2FnZXMuXG4gICAqIEFsc28gZW5hYmxlcyBzdGFjayB0cmFjZSBmb3Igd2FybmluZ3MuXG4gICAqXG4gICAqIEB0eXBlIHtCb29sZWFufVxuICAgKi9cblxuICBkZWJ1ZzogZmFsc2UsXG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdG8gc3VwcHJlc3Mgd2FybmluZ3MuXG4gICAqXG4gICAqIEB0eXBlIHtCb29sZWFufVxuICAgKi9cblxuICBzaWxlbnQ6IGZhbHNlLFxuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRvIHVzZSBhc3luYyByZW5kZXJpbmcuXG4gICAqL1xuXG4gIGFzeW5jOiB0cnVlLFxuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRvIHdhcm4gYWdhaW5zdCBlcnJvcnMgY2F1Z2h0IHdoZW4gZXZhbHVhdGluZ1xuICAgKiBleHByZXNzaW9ucy5cbiAgICovXG5cbiAgd2FybkV4cHJlc3Npb25FcnJvcnM6IHRydWUsXG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgb3Igbm90IHRvIGhhbmRsZSBmdWxseSBvYmplY3QgcHJvcGVydGllcyB3aGljaFxuICAgKiBhcmUgYWxyZWFkeSBiYWNrZWQgYnkgZ2V0dGVycyBhbmQgc2V0ZXJzLiBEZXBlbmRpbmcgb25cbiAgICogdXNlIGNhc2UgYW5kIGVudmlyb25tZW50LCB0aGlzIG1pZ2h0IGludHJvZHVjZSBub24tbmVnbGlibGVcbiAgICogcGVyZm9ybWFuY2UgcGVuYWx0aWVzLlxuICAgKi9cbiAgY29udmVydEFsbFByb3BlcnRpZXM6IGZhbHNlLFxuXG4gIC8qKlxuICAgKiBJbnRlcm5hbCBmbGFnIHRvIGluZGljYXRlIHRoZSBkZWxpbWl0ZXJzIGhhdmUgYmVlblxuICAgKiBjaGFuZ2VkLlxuICAgKlxuICAgKiBAdHlwZSB7Qm9vbGVhbn1cbiAgICovXG5cbiAgX2RlbGltaXRlcnNDaGFuZ2VkOiB0cnVlLFxuXG4gIC8qKlxuICAgKiBMaXN0IG9mIGFzc2V0IHR5cGVzIHRoYXQgYSBjb21wb25lbnQgY2FuIG93bi5cbiAgICpcbiAgICogQHR5cGUge0FycmF5fVxuICAgKi9cblxuICBfYXNzZXRUeXBlczogWydjb21wb25lbnQnLCAnZGlyZWN0aXZlJywgJ2VsZW1lbnREaXJlY3RpdmUnLCAnZmlsdGVyJywgJ3RyYW5zaXRpb24nLCAncGFydGlhbCddLFxuXG4gIC8qKlxuICAgKiBwcm9wIGJpbmRpbmcgbW9kZXNcbiAgICovXG5cbiAgX3Byb3BCaW5kaW5nTW9kZXM6IHtcbiAgICBPTkVfV0FZOiAwLFxuICAgIFRXT19XQVk6IDEsXG4gICAgT05FX1RJTUU6IDJcbiAgfSxcblxuICAvKipcbiAgICogTWF4IGNpcmN1bGFyIHVwZGF0ZXMgYWxsb3dlZCBpbiBhIGJhdGNoZXIgZmx1c2ggY3ljbGUuXG4gICAqL1xuXG4gIF9tYXhVcGRhdGVDb3VudDogMTAwXG5cbn0sIHtcbiAgZGVsaW1pdGVyczogeyAvKipcbiAgICAgICAgICAgICAgICAgKiBJbnRlcnBvbGF0aW9uIGRlbGltaXRlcnMuIENoYW5naW5nIHRoZXNlIHdvdWxkIHRyaWdnZXJcbiAgICAgICAgICAgICAgICAgKiB0aGUgdGV4dCBwYXJzZXIgdG8gcmUtY29tcGlsZSB0aGUgcmVndWxhciBleHByZXNzaW9ucy5cbiAgICAgICAgICAgICAgICAgKlxuICAgICAgICAgICAgICAgICAqIEB0eXBlIHtBcnJheTxTdHJpbmc+fVxuICAgICAgICAgICAgICAgICAqL1xuXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gZGVsaW1pdGVycztcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KHZhbCkge1xuICAgICAgZGVsaW1pdGVycyA9IHZhbDtcbiAgICAgIGNvbXBpbGVSZWdleCgpO1xuICAgIH0sXG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIGVudW1lcmFibGU6IHRydWVcbiAgfSxcbiAgdW5zYWZlRGVsaW1pdGVyczoge1xuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgcmV0dXJuIHVuc2FmZURlbGltaXRlcnM7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIHNldCh2YWwpIHtcbiAgICAgIHVuc2FmZURlbGltaXRlcnMgPSB2YWw7XG4gICAgICBjb21waWxlUmVnZXgoKTtcbiAgICB9LFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICBlbnVtZXJhYmxlOiB0cnVlXG4gIH1cbn0pO1xuXG52YXIgd2FybiA9IHVuZGVmaW5lZDtcblxuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgaGFzQ29uc29sZSA9IHR5cGVvZiBjb25zb2xlICE9PSAndW5kZWZpbmVkJztcbiAgICB3YXJuID0gZnVuY3Rpb24gKG1zZywgZSkge1xuICAgICAgaWYgKGhhc0NvbnNvbGUgJiYgKCFjb25maWcuc2lsZW50IHx8IGNvbmZpZy5kZWJ1ZykpIHtcbiAgICAgICAgY29uc29sZS53YXJuKCdbVnVlIHdhcm5dOiAnICsgbXNnKTtcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICAgIGlmIChjb25maWcuZGVidWcpIHtcbiAgICAgICAgICBpZiAoZSkge1xuICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKG5ldyBFcnJvcignV2FybmluZyBTdGFjayBUcmFjZScpLnN0YWNrKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuICB9KSgpO1xufVxuXG4vKipcbiAqIEFwcGVuZCB3aXRoIHRyYW5zaXRpb24uXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcbiAqIEBwYXJhbSB7VnVlfSB2bVxuICogQHBhcmFtIHtGdW5jdGlvbn0gW2NiXVxuICovXG5cbmZ1bmN0aW9uIGFwcGVuZFdpdGhUcmFuc2l0aW9uKGVsLCB0YXJnZXQsIHZtLCBjYikge1xuICBhcHBseVRyYW5zaXRpb24oZWwsIDEsIGZ1bmN0aW9uICgpIHtcbiAgICB0YXJnZXQuYXBwZW5kQ2hpbGQoZWwpO1xuICB9LCB2bSwgY2IpO1xufVxuXG4vKipcbiAqIEluc2VydEJlZm9yZSB3aXRoIHRyYW5zaXRpb24uXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcbiAqIEBwYXJhbSB7VnVlfSB2bVxuICogQHBhcmFtIHtGdW5jdGlvbn0gW2NiXVxuICovXG5cbmZ1bmN0aW9uIGJlZm9yZVdpdGhUcmFuc2l0aW9uKGVsLCB0YXJnZXQsIHZtLCBjYikge1xuICBhcHBseVRyYW5zaXRpb24oZWwsIDEsIGZ1bmN0aW9uICgpIHtcbiAgICBiZWZvcmUoZWwsIHRhcmdldCk7XG4gIH0sIHZtLCBjYik7XG59XG5cbi8qKlxuICogUmVtb3ZlIHdpdGggdHJhbnNpdGlvbi5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKiBAcGFyYW0ge1Z1ZX0gdm1cbiAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYl1cbiAqL1xuXG5mdW5jdGlvbiByZW1vdmVXaXRoVHJhbnNpdGlvbihlbCwgdm0sIGNiKSB7XG4gIGFwcGx5VHJhbnNpdGlvbihlbCwgLTEsIGZ1bmN0aW9uICgpIHtcbiAgICByZW1vdmUoZWwpO1xuICB9LCB2bSwgY2IpO1xufVxuXG4vKipcbiAqIEFwcGx5IHRyYW5zaXRpb25zIHdpdGggYW4gb3BlcmF0aW9uIGNhbGxiYWNrLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEBwYXJhbSB7TnVtYmVyfSBkaXJlY3Rpb25cbiAqICAgICAgICAgICAgICAgICAgMTogZW50ZXJcbiAqICAgICAgICAgICAgICAgICAtMTogbGVhdmVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wIC0gdGhlIGFjdHVhbCBET00gb3BlcmF0aW9uXG4gKiBAcGFyYW0ge1Z1ZX0gdm1cbiAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYl1cbiAqL1xuXG5mdW5jdGlvbiBhcHBseVRyYW5zaXRpb24oZWwsIGRpcmVjdGlvbiwgb3AsIHZtLCBjYikge1xuICB2YXIgdHJhbnNpdGlvbiA9IGVsLl9fdl90cmFucztcbiAgaWYgKCF0cmFuc2l0aW9uIHx8XG4gIC8vIHNraXAgaWYgdGhlcmUgYXJlIG5vIGpzIGhvb2tzIGFuZCBDU1MgdHJhbnNpdGlvbiBpc1xuICAvLyBub3Qgc3VwcG9ydGVkXG4gICF0cmFuc2l0aW9uLmhvb2tzICYmICF0cmFuc2l0aW9uRW5kRXZlbnQgfHxcbiAgLy8gc2tpcCB0cmFuc2l0aW9ucyBmb3IgaW5pdGlhbCBjb21waWxlXG4gICF2bS5faXNDb21waWxlZCB8fFxuICAvLyBpZiB0aGUgdm0gaXMgYmVpbmcgbWFuaXB1bGF0ZWQgYnkgYSBwYXJlbnQgZGlyZWN0aXZlXG4gIC8vIGR1cmluZyB0aGUgcGFyZW50J3MgY29tcGlsYXRpb24gcGhhc2UsIHNraXAgdGhlXG4gIC8vIGFuaW1hdGlvbi5cbiAgdm0uJHBhcmVudCAmJiAhdm0uJHBhcmVudC5faXNDb21waWxlZCkge1xuICAgIG9wKCk7XG4gICAgaWYgKGNiKSBjYigpO1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgYWN0aW9uID0gZGlyZWN0aW9uID4gMCA/ICdlbnRlcicgOiAnbGVhdmUnO1xuICB0cmFuc2l0aW9uW2FjdGlvbl0ob3AsIGNiKTtcbn1cblxuLyoqXG4gKiBRdWVyeSBhbiBlbGVtZW50IHNlbGVjdG9yIGlmIGl0J3Mgbm90IGFuIGVsZW1lbnQgYWxyZWFkeS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xFbGVtZW50fSBlbFxuICogQHJldHVybiB7RWxlbWVudH1cbiAqL1xuXG5mdW5jdGlvbiBxdWVyeShlbCkge1xuICBpZiAodHlwZW9mIGVsID09PSAnc3RyaW5nJykge1xuICAgIHZhciBzZWxlY3RvciA9IGVsO1xuICAgIGVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihlbCk7XG4gICAgaWYgKCFlbCkge1xuICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB3YXJuKCdDYW5ub3QgZmluZCBlbGVtZW50OiAnICsgc2VsZWN0b3IpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZWw7XG59XG5cbi8qKlxuICogQ2hlY2sgaWYgYSBub2RlIGlzIGluIHRoZSBkb2N1bWVudC5cbiAqIE5vdGU6IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jb250YWlucyBzaG91bGQgd29yayBoZXJlXG4gKiBidXQgYWx3YXlzIHJldHVybnMgZmFsc2UgZm9yIGNvbW1lbnQgbm9kZXMgaW4gcGhhbnRvbWpzLFxuICogbWFraW5nIHVuaXQgdGVzdHMgZGlmZmljdWx0LiBUaGlzIGlzIGZpeGVkIGJ5IGRvaW5nIHRoZVxuICogY29udGFpbnMoKSBjaGVjayBvbiB0aGUgbm9kZSdzIHBhcmVudE5vZGUgaW5zdGVhZCBvZlxuICogdGhlIG5vZGUgaXRzZWxmLlxuICpcbiAqIEBwYXJhbSB7Tm9kZX0gbm9kZVxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqL1xuXG5mdW5jdGlvbiBpbkRvYyhub2RlKSB7XG4gIHZhciBkb2MgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ7XG4gIHZhciBwYXJlbnQgPSBub2RlICYmIG5vZGUucGFyZW50Tm9kZTtcbiAgcmV0dXJuIGRvYyA9PT0gbm9kZSB8fCBkb2MgPT09IHBhcmVudCB8fCAhIShwYXJlbnQgJiYgcGFyZW50Lm5vZGVUeXBlID09PSAxICYmIGRvYy5jb250YWlucyhwYXJlbnQpKTtcbn1cblxuLyoqXG4gKiBHZXQgYW5kIHJlbW92ZSBhbiBhdHRyaWJ1dGUgZnJvbSBhIG5vZGUuXG4gKlxuICogQHBhcmFtIHtOb2RlfSBub2RlXG4gKiBAcGFyYW0ge1N0cmluZ30gX2F0dHJcbiAqL1xuXG5mdW5jdGlvbiBnZXRBdHRyKG5vZGUsIF9hdHRyKSB7XG4gIHZhciB2YWwgPSBub2RlLmdldEF0dHJpYnV0ZShfYXR0cik7XG4gIGlmICh2YWwgIT09IG51bGwpIHtcbiAgICBub2RlLnJlbW92ZUF0dHJpYnV0ZShfYXR0cik7XG4gIH1cbiAgcmV0dXJuIHZhbDtcbn1cblxuLyoqXG4gKiBHZXQgYW4gYXR0cmlidXRlIHdpdGggY29sb24gb3Igdi1iaW5kOiBwcmVmaXguXG4gKlxuICogQHBhcmFtIHtOb2RlfSBub2RlXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICogQHJldHVybiB7U3RyaW5nfG51bGx9XG4gKi9cblxuZnVuY3Rpb24gZ2V0QmluZEF0dHIobm9kZSwgbmFtZSkge1xuICB2YXIgdmFsID0gZ2V0QXR0cihub2RlLCAnOicgKyBuYW1lKTtcbiAgaWYgKHZhbCA9PT0gbnVsbCkge1xuICAgIHZhbCA9IGdldEF0dHIobm9kZSwgJ3YtYmluZDonICsgbmFtZSk7XG4gIH1cbiAgcmV0dXJuIHZhbDtcbn1cblxuLyoqXG4gKiBDaGVjayB0aGUgcHJlc2VuY2Ugb2YgYSBiaW5kIGF0dHJpYnV0ZS5cbiAqXG4gKiBAcGFyYW0ge05vZGV9IG5vZGVcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICovXG5cbmZ1bmN0aW9uIGhhc0JpbmRBdHRyKG5vZGUsIG5hbWUpIHtcbiAgcmV0dXJuIG5vZGUuaGFzQXR0cmlidXRlKG5hbWUpIHx8IG5vZGUuaGFzQXR0cmlidXRlKCc6JyArIG5hbWUpIHx8IG5vZGUuaGFzQXR0cmlidXRlKCd2LWJpbmQ6JyArIG5hbWUpO1xufVxuXG4vKipcbiAqIEluc2VydCBlbCBiZWZvcmUgdGFyZ2V0XG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcbiAqL1xuXG5mdW5jdGlvbiBiZWZvcmUoZWwsIHRhcmdldCkge1xuICB0YXJnZXQucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoZWwsIHRhcmdldCk7XG59XG5cbi8qKlxuICogSW5zZXJ0IGVsIGFmdGVyIHRhcmdldFxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEBwYXJhbSB7RWxlbWVudH0gdGFyZ2V0XG4gKi9cblxuZnVuY3Rpb24gYWZ0ZXIoZWwsIHRhcmdldCkge1xuICBpZiAodGFyZ2V0Lm5leHRTaWJsaW5nKSB7XG4gICAgYmVmb3JlKGVsLCB0YXJnZXQubmV4dFNpYmxpbmcpO1xuICB9IGVsc2Uge1xuICAgIHRhcmdldC5wYXJlbnROb2RlLmFwcGVuZENoaWxkKGVsKTtcbiAgfVxufVxuXG4vKipcbiAqIFJlbW92ZSBlbCBmcm9tIERPTVxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqL1xuXG5mdW5jdGlvbiByZW1vdmUoZWwpIHtcbiAgZWwucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChlbCk7XG59XG5cbi8qKlxuICogUHJlcGVuZCBlbCB0byB0YXJnZXRcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldFxuICovXG5cbmZ1bmN0aW9uIHByZXBlbmQoZWwsIHRhcmdldCkge1xuICBpZiAodGFyZ2V0LmZpcnN0Q2hpbGQpIHtcbiAgICBiZWZvcmUoZWwsIHRhcmdldC5maXJzdENoaWxkKTtcbiAgfSBlbHNlIHtcbiAgICB0YXJnZXQuYXBwZW5kQ2hpbGQoZWwpO1xuICB9XG59XG5cbi8qKlxuICogUmVwbGFjZSB0YXJnZXQgd2l0aCBlbFxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gdGFyZ2V0XG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKi9cblxuZnVuY3Rpb24gcmVwbGFjZSh0YXJnZXQsIGVsKSB7XG4gIHZhciBwYXJlbnQgPSB0YXJnZXQucGFyZW50Tm9kZTtcbiAgaWYgKHBhcmVudCkge1xuICAgIHBhcmVudC5yZXBsYWNlQ2hpbGQoZWwsIHRhcmdldCk7XG4gIH1cbn1cblxuLyoqXG4gKiBBZGQgZXZlbnQgbGlzdGVuZXIgc2hvcnRoYW5kLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2JcbiAqL1xuXG5mdW5jdGlvbiBvbiQxKGVsLCBldmVudCwgY2IpIHtcbiAgZWwuYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgY2IpO1xufVxuXG4vKipcbiAqIFJlbW92ZSBldmVudCBsaXN0ZW5lciBzaG9ydGhhbmQuXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYlxuICovXG5cbmZ1bmN0aW9uIG9mZihlbCwgZXZlbnQsIGNiKSB7XG4gIGVsLnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnQsIGNiKTtcbn1cblxuLyoqXG4gKiBJbiBJRTksIHNldEF0dHJpYnV0ZSgnY2xhc3MnKSB3aWxsIHJlc3VsdCBpbiBlbXB0eSBjbGFzc1xuICogaWYgdGhlIGVsZW1lbnQgYWxzbyBoYXMgdGhlIDpjbGFzcyBhdHRyaWJ1dGU7IEhvd2V2ZXIgaW5cbiAqIFBoYW50b21KUywgc2V0dGluZyBgY2xhc3NOYW1lYCBkb2VzIG5vdCB3b3JrIG9uIFNWRyBlbGVtZW50cy4uLlxuICogU28gd2UgaGF2ZSB0byBkbyBhIGNvbmRpdGlvbmFsIGNoZWNrIGhlcmUuXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICogQHBhcmFtIHtTdHJpbmd9IGNsc1xuICovXG5cbmZ1bmN0aW9uIHNldENsYXNzKGVsLCBjbHMpIHtcbiAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gIGlmIChpc0lFOSAmJiAhKGVsIGluc3RhbmNlb2YgU1ZHRWxlbWVudCkpIHtcbiAgICBlbC5jbGFzc05hbWUgPSBjbHM7XG4gIH0gZWxzZSB7XG4gICAgZWwuc2V0QXR0cmlidXRlKCdjbGFzcycsIGNscyk7XG4gIH1cbn1cblxuLyoqXG4gKiBBZGQgY2xhc3Mgd2l0aCBjb21wYXRpYmlsaXR5IGZvciBJRSAmIFNWR1xuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEBwYXJhbSB7U3RyaW5nfSBjbHNcbiAqL1xuXG5mdW5jdGlvbiBhZGRDbGFzcyhlbCwgY2xzKSB7XG4gIGlmIChlbC5jbGFzc0xpc3QpIHtcbiAgICBlbC5jbGFzc0xpc3QuYWRkKGNscyk7XG4gIH0gZWxzZSB7XG4gICAgdmFyIGN1ciA9ICcgJyArIChlbC5nZXRBdHRyaWJ1dGUoJ2NsYXNzJykgfHwgJycpICsgJyAnO1xuICAgIGlmIChjdXIuaW5kZXhPZignICcgKyBjbHMgKyAnICcpIDwgMCkge1xuICAgICAgc2V0Q2xhc3MoZWwsIChjdXIgKyBjbHMpLnRyaW0oKSk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogUmVtb3ZlIGNsYXNzIHdpdGggY29tcGF0aWJpbGl0eSBmb3IgSUUgJiBTVkdcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKiBAcGFyYW0ge1N0cmluZ30gY2xzXG4gKi9cblxuZnVuY3Rpb24gcmVtb3ZlQ2xhc3MoZWwsIGNscykge1xuICBpZiAoZWwuY2xhc3NMaXN0KSB7XG4gICAgZWwuY2xhc3NMaXN0LnJlbW92ZShjbHMpO1xuICB9IGVsc2Uge1xuICAgIHZhciBjdXIgPSAnICcgKyAoZWwuZ2V0QXR0cmlidXRlKCdjbGFzcycpIHx8ICcnKSArICcgJztcbiAgICB2YXIgdGFyID0gJyAnICsgY2xzICsgJyAnO1xuICAgIHdoaWxlIChjdXIuaW5kZXhPZih0YXIpID49IDApIHtcbiAgICAgIGN1ciA9IGN1ci5yZXBsYWNlKHRhciwgJyAnKTtcbiAgICB9XG4gICAgc2V0Q2xhc3MoZWwsIGN1ci50cmltKCkpO1xuICB9XG4gIGlmICghZWwuY2xhc3NOYW1lKSB7XG4gICAgZWwucmVtb3ZlQXR0cmlidXRlKCdjbGFzcycpO1xuICB9XG59XG5cbi8qKlxuICogRXh0cmFjdCByYXcgY29udGVudCBpbnNpZGUgYW4gZWxlbWVudCBpbnRvIGEgdGVtcG9yYXJ5XG4gKiBjb250YWluZXIgZGl2XG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICogQHBhcmFtIHtCb29sZWFufSBhc0ZyYWdtZW50XG4gKiBAcmV0dXJuIHtFbGVtZW50fVxuICovXG5cbmZ1bmN0aW9uIGV4dHJhY3RDb250ZW50KGVsLCBhc0ZyYWdtZW50KSB7XG4gIHZhciBjaGlsZDtcbiAgdmFyIHJhd0NvbnRlbnQ7XG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICBpZiAoaXNUZW1wbGF0ZShlbCkgJiYgZWwuY29udGVudCBpbnN0YW5jZW9mIERvY3VtZW50RnJhZ21lbnQpIHtcbiAgICBlbCA9IGVsLmNvbnRlbnQ7XG4gIH1cbiAgaWYgKGVsLmhhc0NoaWxkTm9kZXMoKSkge1xuICAgIHRyaW1Ob2RlKGVsKTtcbiAgICByYXdDb250ZW50ID0gYXNGcmFnbWVudCA/IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKSA6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIC8qIGVzbGludC1kaXNhYmxlIG5vLWNvbmQtYXNzaWduICovXG4gICAgd2hpbGUgKGNoaWxkID0gZWwuZmlyc3RDaGlsZCkge1xuICAgICAgLyogZXNsaW50LWVuYWJsZSBuby1jb25kLWFzc2lnbiAqL1xuICAgICAgcmF3Q29udGVudC5hcHBlbmRDaGlsZChjaGlsZCk7XG4gICAgfVxuICB9XG4gIHJldHVybiByYXdDb250ZW50O1xufVxuXG4vKipcbiAqIFRyaW0gcG9zc2libGUgZW1wdHkgaGVhZC90YWlsIHRleHROb2RlcyBpbnNpZGUgYSBwYXJlbnQuXG4gKlxuICogQHBhcmFtIHtOb2RlfSBub2RlXG4gKi9cblxuZnVuY3Rpb24gdHJpbU5vZGUobm9kZSkge1xuICB0cmltKG5vZGUsIG5vZGUuZmlyc3RDaGlsZCk7XG4gIHRyaW0obm9kZSwgbm9kZS5sYXN0Q2hpbGQpO1xufVxuXG5mdW5jdGlvbiB0cmltKHBhcmVudCwgbm9kZSkge1xuICBpZiAobm9kZSAmJiBub2RlLm5vZGVUeXBlID09PSAzICYmICFub2RlLmRhdGEudHJpbSgpKSB7XG4gICAgcGFyZW50LnJlbW92ZUNoaWxkKG5vZGUpO1xuICB9XG59XG5cbi8qKlxuICogQ2hlY2sgaWYgYW4gZWxlbWVudCBpcyBhIHRlbXBsYXRlIHRhZy5cbiAqIE5vdGUgaWYgdGhlIHRlbXBsYXRlIGFwcGVhcnMgaW5zaWRlIGFuIFNWRyBpdHMgdGFnTmFtZVxuICogd2lsbCBiZSBpbiBsb3dlcmNhc2UuXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICovXG5cbmZ1bmN0aW9uIGlzVGVtcGxhdGUoZWwpIHtcbiAgcmV0dXJuIGVsLnRhZ05hbWUgJiYgZWwudGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSAndGVtcGxhdGUnO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhbiBcImFuY2hvclwiIGZvciBwZXJmb3JtaW5nIGRvbSBpbnNlcnRpb24vcmVtb3ZhbHMuXG4gKiBUaGlzIGlzIHVzZWQgaW4gYSBudW1iZXIgb2Ygc2NlbmFyaW9zOlxuICogLSBmcmFnbWVudCBpbnN0YW5jZVxuICogLSB2LWh0bWxcbiAqIC0gdi1pZlxuICogLSB2LWZvclxuICogLSBjb21wb25lbnRcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gY29udGVudFxuICogQHBhcmFtIHtCb29sZWFufSBwZXJzaXN0IC0gSUUgdHJhc2hlcyBlbXB0eSB0ZXh0Tm9kZXMgb25cbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsb25lTm9kZSh0cnVlKSwgc28gaW4gY2VydGFpblxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZXMgdGhlIGFuY2hvciBuZWVkcyB0byBiZVxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgbm9uLWVtcHR5IHRvIGJlIHBlcnNpc3RlZCBpblxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgdGVtcGxhdGVzLlxuICogQHJldHVybiB7Q29tbWVudHxUZXh0fVxuICovXG5cbmZ1bmN0aW9uIGNyZWF0ZUFuY2hvcihjb250ZW50LCBwZXJzaXN0KSB7XG4gIHZhciBhbmNob3IgPSBjb25maWcuZGVidWcgPyBkb2N1bWVudC5jcmVhdGVDb21tZW50KGNvbnRlbnQpIDogZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUocGVyc2lzdCA/ICcgJyA6ICcnKTtcbiAgYW5jaG9yLl9fdnVlX2FuY2hvciA9IHRydWU7XG4gIHJldHVybiBhbmNob3I7XG59XG5cbi8qKlxuICogRmluZCBhIGNvbXBvbmVudCByZWYgYXR0cmlidXRlIHRoYXQgc3RhcnRzIHdpdGggJC5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IG5vZGVcbiAqIEByZXR1cm4ge1N0cmluZ3x1bmRlZmluZWR9XG4gKi9cblxudmFyIHJlZlJFID0gL152LXJlZjovO1xuXG5mdW5jdGlvbiBmaW5kUmVmKG5vZGUpIHtcbiAgaWYgKG5vZGUuaGFzQXR0cmlidXRlcygpKSB7XG4gICAgdmFyIGF0dHJzID0gbm9kZS5hdHRyaWJ1dGVzO1xuICAgIGZvciAodmFyIGkgPSAwLCBsID0gYXR0cnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICB2YXIgbmFtZSA9IGF0dHJzW2ldLm5hbWU7XG4gICAgICBpZiAocmVmUkUudGVzdChuYW1lKSkge1xuICAgICAgICByZXR1cm4gY2FtZWxpemUobmFtZS5yZXBsYWNlKHJlZlJFLCAnJykpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIE1hcCBhIGZ1bmN0aW9uIHRvIGEgcmFuZ2Ugb2Ygbm9kZXMgLlxuICpcbiAqIEBwYXJhbSB7Tm9kZX0gbm9kZVxuICogQHBhcmFtIHtOb2RlfSBlbmRcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wXG4gKi9cblxuZnVuY3Rpb24gbWFwTm9kZVJhbmdlKG5vZGUsIGVuZCwgb3ApIHtcbiAgdmFyIG5leHQ7XG4gIHdoaWxlIChub2RlICE9PSBlbmQpIHtcbiAgICBuZXh0ID0gbm9kZS5uZXh0U2libGluZztcbiAgICBvcChub2RlKTtcbiAgICBub2RlID0gbmV4dDtcbiAgfVxuICBvcChlbmQpO1xufVxuXG4vKipcbiAqIFJlbW92ZSBhIHJhbmdlIG9mIG5vZGVzIHdpdGggdHJhbnNpdGlvbiwgc3RvcmVcbiAqIHRoZSBub2RlcyBpbiBhIGZyYWdtZW50IHdpdGggY29ycmVjdCBvcmRlcmluZyxcbiAqIGFuZCBjYWxsIGNhbGxiYWNrIHdoZW4gZG9uZS5cbiAqXG4gKiBAcGFyYW0ge05vZGV9IHN0YXJ0XG4gKiBAcGFyYW0ge05vZGV9IGVuZFxuICogQHBhcmFtIHtWdWV9IHZtXG4gKiBAcGFyYW0ge0RvY3VtZW50RnJhZ21lbnR9IGZyYWdcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNiXG4gKi9cblxuZnVuY3Rpb24gcmVtb3ZlTm9kZVJhbmdlKHN0YXJ0LCBlbmQsIHZtLCBmcmFnLCBjYikge1xuICB2YXIgZG9uZSA9IGZhbHNlO1xuICB2YXIgcmVtb3ZlZCA9IDA7XG4gIHZhciBub2RlcyA9IFtdO1xuICBtYXBOb2RlUmFuZ2Uoc3RhcnQsIGVuZCwgZnVuY3Rpb24gKG5vZGUpIHtcbiAgICBpZiAobm9kZSA9PT0gZW5kKSBkb25lID0gdHJ1ZTtcbiAgICBub2Rlcy5wdXNoKG5vZGUpO1xuICAgIHJlbW92ZVdpdGhUcmFuc2l0aW9uKG5vZGUsIHZtLCBvblJlbW92ZWQpO1xuICB9KTtcbiAgZnVuY3Rpb24gb25SZW1vdmVkKCkge1xuICAgIHJlbW92ZWQrKztcbiAgICBpZiAoZG9uZSAmJiByZW1vdmVkID49IG5vZGVzLmxlbmd0aCkge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBmcmFnLmFwcGVuZENoaWxkKG5vZGVzW2ldKTtcbiAgICAgIH1cbiAgICAgIGNiICYmIGNiKCk7XG4gICAgfVxuICB9XG59XG5cbnZhciBjb21tb25UYWdSRSA9IC9eKGRpdnxwfHNwYW58aW1nfGF8YnxpfGJyfHVsfG9sfGxpfGgxfGgyfGgzfGg0fGg1fGg2fGNvZGV8cHJlfHRhYmxlfHRofHRkfHRyfGZvcm18bGFiZWx8aW5wdXR8c2VsZWN0fG9wdGlvbnxuYXZ8YXJ0aWNsZXxzZWN0aW9ufGhlYWRlcnxmb290ZXIpJC87XG52YXIgcmVzZXJ2ZWRUYWdSRSA9IC9eKHNsb3R8cGFydGlhbHxjb21wb25lbnQpJC87XG5cbi8qKlxuICogQ2hlY2sgaWYgYW4gZWxlbWVudCBpcyBhIGNvbXBvbmVudCwgaWYgeWVzIHJldHVybiBpdHNcbiAqIGNvbXBvbmVudCBpZC5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHJldHVybiB7T2JqZWN0fHVuZGVmaW5lZH1cbiAqL1xuXG5mdW5jdGlvbiBjaGVja0NvbXBvbmVudEF0dHIoZWwsIG9wdGlvbnMpIHtcbiAgdmFyIHRhZyA9IGVsLnRhZ05hbWUudG9Mb3dlckNhc2UoKTtcbiAgdmFyIGhhc0F0dHJzID0gZWwuaGFzQXR0cmlidXRlcygpO1xuICBpZiAoIWNvbW1vblRhZ1JFLnRlc3QodGFnKSAmJiAhcmVzZXJ2ZWRUYWdSRS50ZXN0KHRhZykpIHtcbiAgICBpZiAocmVzb2x2ZUFzc2V0KG9wdGlvbnMsICdjb21wb25lbnRzJywgdGFnKSkge1xuICAgICAgcmV0dXJuIHsgaWQ6IHRhZyB9O1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgaXMgPSBoYXNBdHRycyAmJiBnZXRJc0JpbmRpbmcoZWwpO1xuICAgICAgaWYgKGlzKSB7XG4gICAgICAgIHJldHVybiBpcztcbiAgICAgIH0gZWxzZSBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICBpZiAodGFnLmluZGV4T2YoJy0nKSA+IC0xIHx8IC9IVE1MVW5rbm93bkVsZW1lbnQvLnRlc3QoZWwudG9TdHJpbmcoKSkgJiZcbiAgICAgICAgLy8gQ2hyb21lIHJldHVybnMgdW5rbm93biBmb3Igc2V2ZXJhbCBIVE1MNSBlbGVtZW50cy5cbiAgICAgICAgLy8gaHR0cHM6Ly9jb2RlLmdvb2dsZS5jb20vcC9jaHJvbWl1bS9pc3N1ZXMvZGV0YWlsP2lkPTU0MDUyNlxuICAgICAgICAhL14oZGF0YXx0aW1lfHJ0Y3xyYikkLy50ZXN0KHRhZykpIHtcbiAgICAgICAgICB3YXJuKCdVbmtub3duIGN1c3RvbSBlbGVtZW50OiA8JyArIHRhZyArICc+IC0gZGlkIHlvdSAnICsgJ3JlZ2lzdGVyIHRoZSBjb21wb25lbnQgY29ycmVjdGx5PycpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2UgaWYgKGhhc0F0dHJzKSB7XG4gICAgcmV0dXJuIGdldElzQmluZGluZyhlbCk7XG4gIH1cbn1cblxuLyoqXG4gKiBHZXQgXCJpc1wiIGJpbmRpbmcgZnJvbSBhbiBlbGVtZW50LlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEByZXR1cm4ge09iamVjdHx1bmRlZmluZWR9XG4gKi9cblxuZnVuY3Rpb24gZ2V0SXNCaW5kaW5nKGVsKSB7XG4gIC8vIGR5bmFtaWMgc3ludGF4XG4gIHZhciBleHAgPSBnZXRBdHRyKGVsLCAnaXMnKTtcbiAgaWYgKGV4cCAhPSBudWxsKSB7XG4gICAgcmV0dXJuIHsgaWQ6IGV4cCB9O1xuICB9IGVsc2Uge1xuICAgIGV4cCA9IGdldEJpbmRBdHRyKGVsLCAnaXMnKTtcbiAgICBpZiAoZXhwICE9IG51bGwpIHtcbiAgICAgIHJldHVybiB7IGlkOiBleHAsIGR5bmFtaWM6IHRydWUgfTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBTZXQgYSBwcm9wJ3MgaW5pdGlhbCB2YWx1ZSBvbiBhIHZtIGFuZCBpdHMgZGF0YSBvYmplY3QuXG4gKlxuICogQHBhcmFtIHtWdWV9IHZtXG4gKiBAcGFyYW0ge09iamVjdH0gcHJvcFxuICogQHBhcmFtIHsqfSB2YWx1ZVxuICovXG5cbmZ1bmN0aW9uIGluaXRQcm9wKHZtLCBwcm9wLCB2YWx1ZSkge1xuICB2YXIga2V5ID0gcHJvcC5wYXRoO1xuICB2YWx1ZSA9IGNvZXJjZVByb3AocHJvcCwgdmFsdWUpO1xuICB2bVtrZXldID0gdm0uX2RhdGFba2V5XSA9IGFzc2VydFByb3AocHJvcCwgdmFsdWUpID8gdmFsdWUgOiB1bmRlZmluZWQ7XG59XG5cbi8qKlxuICogQXNzZXJ0IHdoZXRoZXIgYSBwcm9wIGlzIHZhbGlkLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBwcm9wXG4gKiBAcGFyYW0geyp9IHZhbHVlXG4gKi9cblxuZnVuY3Rpb24gYXNzZXJ0UHJvcChwcm9wLCB2YWx1ZSkge1xuICAvLyBpZiBhIHByb3AgaXMgbm90IHByb3ZpZGVkIGFuZCBpcyBub3QgcmVxdWlyZWQsXG4gIC8vIHNraXAgdGhlIGNoZWNrLlxuICBpZiAocHJvcC5yYXcgPT09IG51bGwgJiYgIXByb3AucmVxdWlyZWQpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICB2YXIgb3B0aW9ucyA9IHByb3Aub3B0aW9ucztcbiAgdmFyIHR5cGUgPSBvcHRpb25zLnR5cGU7XG4gIHZhciB2YWxpZCA9IHRydWU7XG4gIHZhciBleHBlY3RlZFR5cGU7XG4gIGlmICh0eXBlKSB7XG4gICAgaWYgKHR5cGUgPT09IFN0cmluZykge1xuICAgICAgZXhwZWN0ZWRUeXBlID0gJ3N0cmluZyc7XG4gICAgICB2YWxpZCA9IHR5cGVvZiB2YWx1ZSA9PT0gZXhwZWN0ZWRUeXBlO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gTnVtYmVyKSB7XG4gICAgICBleHBlY3RlZFR5cGUgPSAnbnVtYmVyJztcbiAgICAgIHZhbGlkID0gdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJztcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09IEJvb2xlYW4pIHtcbiAgICAgIGV4cGVjdGVkVHlwZSA9ICdib29sZWFuJztcbiAgICAgIHZhbGlkID0gdHlwZW9mIHZhbHVlID09PSAnYm9vbGVhbic7XG4gICAgfSBlbHNlIGlmICh0eXBlID09PSBGdW5jdGlvbikge1xuICAgICAgZXhwZWN0ZWRUeXBlID0gJ2Z1bmN0aW9uJztcbiAgICAgIHZhbGlkID0gdHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gT2JqZWN0KSB7XG4gICAgICBleHBlY3RlZFR5cGUgPSAnb2JqZWN0JztcbiAgICAgIHZhbGlkID0gaXNQbGFpbk9iamVjdCh2YWx1ZSk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09PSBBcnJheSkge1xuICAgICAgZXhwZWN0ZWRUeXBlID0gJ2FycmF5JztcbiAgICAgIHZhbGlkID0gaXNBcnJheSh2YWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbGlkID0gdmFsdWUgaW5zdGFuY2VvZiB0eXBlO1xuICAgIH1cbiAgfVxuICBpZiAoIXZhbGlkKSB7XG4gICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB3YXJuKCdJbnZhbGlkIHByb3A6IHR5cGUgY2hlY2sgZmFpbGVkIGZvciAnICsgcHJvcC5wYXRoICsgJz1cIicgKyBwcm9wLnJhdyArICdcIi4nICsgJyBFeHBlY3RlZCAnICsgZm9ybWF0VHlwZShleHBlY3RlZFR5cGUpICsgJywgZ290ICcgKyBmb3JtYXRWYWx1ZSh2YWx1ZSkgKyAnLicpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICB2YXIgdmFsaWRhdG9yID0gb3B0aW9ucy52YWxpZGF0b3I7XG4gIGlmICh2YWxpZGF0b3IpIHtcbiAgICBpZiAoIXZhbGlkYXRvci5jYWxsKG51bGwsIHZhbHVlKSkge1xuICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB3YXJuKCdJbnZhbGlkIHByb3A6IGN1c3RvbSB2YWxpZGF0b3IgY2hlY2sgZmFpbGVkIGZvciAnICsgcHJvcC5wYXRoICsgJz1cIicgKyBwcm9wLnJhdyArICdcIicpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cblxuLyoqXG4gKiBGb3JjZSBwYXJzaW5nIHZhbHVlIHdpdGggY29lcmNlIG9wdGlvbi5cbiAqXG4gKiBAcGFyYW0geyp9IHZhbHVlXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHJldHVybiB7Kn1cbiAqL1xuXG5mdW5jdGlvbiBjb2VyY2VQcm9wKHByb3AsIHZhbHVlKSB7XG4gIHZhciBjb2VyY2UgPSBwcm9wLm9wdGlvbnMuY29lcmNlO1xuICBpZiAoIWNvZXJjZSkge1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuICAvLyBjb2VyY2UgaXMgYSBmdW5jdGlvblxuICByZXR1cm4gY29lcmNlKHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gZm9ybWF0VHlwZSh2YWwpIHtcbiAgcmV0dXJuIHZhbCA/IHZhbC5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHZhbC5zbGljZSgxKSA6ICdjdXN0b20gdHlwZSc7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdFZhbHVlKHZhbCkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbCkuc2xpY2UoOCwgLTEpO1xufVxuXG4vKipcbiAqIE9wdGlvbiBvdmVyd3JpdGluZyBzdHJhdGVnaWVzIGFyZSBmdW5jdGlvbnMgdGhhdCBoYW5kbGVcbiAqIGhvdyB0byBtZXJnZSBhIHBhcmVudCBvcHRpb24gdmFsdWUgYW5kIGEgY2hpbGQgb3B0aW9uXG4gKiB2YWx1ZSBpbnRvIHRoZSBmaW5hbCB2YWx1ZS5cbiAqXG4gKiBBbGwgc3RyYXRlZ3kgZnVuY3Rpb25zIGZvbGxvdyB0aGUgc2FtZSBzaWduYXR1cmU6XG4gKlxuICogQHBhcmFtIHsqfSBwYXJlbnRWYWxcbiAqIEBwYXJhbSB7Kn0gY2hpbGRWYWxcbiAqIEBwYXJhbSB7VnVlfSBbdm1dXG4gKi9cblxudmFyIHN0cmF0cyA9IGNvbmZpZy5vcHRpb25NZXJnZVN0cmF0ZWdpZXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4vKipcbiAqIEhlbHBlciB0aGF0IHJlY3Vyc2l2ZWx5IG1lcmdlcyB0d28gZGF0YSBvYmplY3RzIHRvZ2V0aGVyLlxuICovXG5cbmZ1bmN0aW9uIG1lcmdlRGF0YSh0bywgZnJvbSkge1xuICB2YXIga2V5LCB0b1ZhbCwgZnJvbVZhbDtcbiAgZm9yIChrZXkgaW4gZnJvbSkge1xuICAgIHRvVmFsID0gdG9ba2V5XTtcbiAgICBmcm9tVmFsID0gZnJvbVtrZXldO1xuICAgIGlmICghaGFzT3duKHRvLCBrZXkpKSB7XG4gICAgICBzZXQodG8sIGtleSwgZnJvbVZhbCk7XG4gICAgfSBlbHNlIGlmIChpc09iamVjdCh0b1ZhbCkgJiYgaXNPYmplY3QoZnJvbVZhbCkpIHtcbiAgICAgIG1lcmdlRGF0YSh0b1ZhbCwgZnJvbVZhbCk7XG4gICAgfVxuICB9XG4gIHJldHVybiB0bztcbn1cblxuLyoqXG4gKiBEYXRhXG4gKi9cblxuc3RyYXRzLmRhdGEgPSBmdW5jdGlvbiAocGFyZW50VmFsLCBjaGlsZFZhbCwgdm0pIHtcbiAgaWYgKCF2bSkge1xuICAgIC8vIGluIGEgVnVlLmV4dGVuZCBtZXJnZSwgYm90aCBzaG91bGQgYmUgZnVuY3Rpb25zXG4gICAgaWYgKCFjaGlsZFZhbCkge1xuICAgICAgcmV0dXJuIHBhcmVudFZhbDtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBjaGlsZFZhbCAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB3YXJuKCdUaGUgXCJkYXRhXCIgb3B0aW9uIHNob3VsZCBiZSBhIGZ1bmN0aW9uICcgKyAndGhhdCByZXR1cm5zIGEgcGVyLWluc3RhbmNlIHZhbHVlIGluIGNvbXBvbmVudCAnICsgJ2RlZmluaXRpb25zLicpO1xuICAgICAgcmV0dXJuIHBhcmVudFZhbDtcbiAgICB9XG4gICAgaWYgKCFwYXJlbnRWYWwpIHtcbiAgICAgIHJldHVybiBjaGlsZFZhbDtcbiAgICB9XG4gICAgLy8gd2hlbiBwYXJlbnRWYWwgJiBjaGlsZFZhbCBhcmUgYm90aCBwcmVzZW50LFxuICAgIC8vIHdlIG5lZWQgdG8gcmV0dXJuIGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIHRoZVxuICAgIC8vIG1lcmdlZCByZXN1bHQgb2YgYm90aCBmdW5jdGlvbnMuLi4gbm8gbmVlZCB0b1xuICAgIC8vIGNoZWNrIGlmIHBhcmVudFZhbCBpcyBhIGZ1bmN0aW9uIGhlcmUgYmVjYXVzZVxuICAgIC8vIGl0IGhhcyB0byBiZSBhIGZ1bmN0aW9uIHRvIHBhc3MgcHJldmlvdXMgbWVyZ2VzLlxuICAgIHJldHVybiBmdW5jdGlvbiBtZXJnZWREYXRhRm4oKSB7XG4gICAgICByZXR1cm4gbWVyZ2VEYXRhKGNoaWxkVmFsLmNhbGwodGhpcyksIHBhcmVudFZhbC5jYWxsKHRoaXMpKTtcbiAgICB9O1xuICB9IGVsc2UgaWYgKHBhcmVudFZhbCB8fCBjaGlsZFZhbCkge1xuICAgIHJldHVybiBmdW5jdGlvbiBtZXJnZWRJbnN0YW5jZURhdGFGbigpIHtcbiAgICAgIC8vIGluc3RhbmNlIG1lcmdlXG4gICAgICB2YXIgaW5zdGFuY2VEYXRhID0gdHlwZW9mIGNoaWxkVmFsID09PSAnZnVuY3Rpb24nID8gY2hpbGRWYWwuY2FsbCh2bSkgOiBjaGlsZFZhbDtcbiAgICAgIHZhciBkZWZhdWx0RGF0YSA9IHR5cGVvZiBwYXJlbnRWYWwgPT09ICdmdW5jdGlvbicgPyBwYXJlbnRWYWwuY2FsbCh2bSkgOiB1bmRlZmluZWQ7XG4gICAgICBpZiAoaW5zdGFuY2VEYXRhKSB7XG4gICAgICAgIHJldHVybiBtZXJnZURhdGEoaW5zdGFuY2VEYXRhLCBkZWZhdWx0RGF0YSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZGVmYXVsdERhdGE7XG4gICAgICB9XG4gICAgfTtcbiAgfVxufTtcblxuLyoqXG4gKiBFbFxuICovXG5cbnN0cmF0cy5lbCA9IGZ1bmN0aW9uIChwYXJlbnRWYWwsIGNoaWxkVmFsLCB2bSkge1xuICBpZiAoIXZtICYmIGNoaWxkVmFsICYmIHR5cGVvZiBjaGlsZFZhbCAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgd2FybignVGhlIFwiZWxcIiBvcHRpb24gc2hvdWxkIGJlIGEgZnVuY3Rpb24gJyArICd0aGF0IHJldHVybnMgYSBwZXItaW5zdGFuY2UgdmFsdWUgaW4gY29tcG9uZW50ICcgKyAnZGVmaW5pdGlvbnMuJyk7XG4gICAgcmV0dXJuO1xuICB9XG4gIHZhciByZXQgPSBjaGlsZFZhbCB8fCBwYXJlbnRWYWw7XG4gIC8vIGludm9rZSB0aGUgZWxlbWVudCBmYWN0b3J5IGlmIHRoaXMgaXMgaW5zdGFuY2UgbWVyZ2VcbiAgcmV0dXJuIHZtICYmIHR5cGVvZiByZXQgPT09ICdmdW5jdGlvbicgPyByZXQuY2FsbCh2bSkgOiByZXQ7XG59O1xuXG4vKipcbiAqIEhvb2tzIGFuZCBwYXJhbSBhdHRyaWJ1dGVzIGFyZSBtZXJnZWQgYXMgYXJyYXlzLlxuICovXG5cbnN0cmF0cy5pbml0ID0gc3RyYXRzLmNyZWF0ZWQgPSBzdHJhdHMucmVhZHkgPSBzdHJhdHMuYXR0YWNoZWQgPSBzdHJhdHMuZGV0YWNoZWQgPSBzdHJhdHMuYmVmb3JlQ29tcGlsZSA9IHN0cmF0cy5jb21waWxlZCA9IHN0cmF0cy5iZWZvcmVEZXN0cm95ID0gc3RyYXRzLmRlc3Ryb3llZCA9IGZ1bmN0aW9uIChwYXJlbnRWYWwsIGNoaWxkVmFsKSB7XG4gIHJldHVybiBjaGlsZFZhbCA/IHBhcmVudFZhbCA/IHBhcmVudFZhbC5jb25jYXQoY2hpbGRWYWwpIDogaXNBcnJheShjaGlsZFZhbCkgPyBjaGlsZFZhbCA6IFtjaGlsZFZhbF0gOiBwYXJlbnRWYWw7XG59O1xuXG4vKipcbiAqIDAuMTEgZGVwcmVjYXRpb24gd2FybmluZ1xuICovXG5cbnN0cmF0cy5wYXJhbUF0dHJpYnV0ZXMgPSBmdW5jdGlvbiAoKSB7XG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgd2FybignXCJwYXJhbUF0dHJpYnV0ZXNcIiBvcHRpb24gaGFzIGJlZW4gZGVwcmVjYXRlZCBpbiAwLjEyLiAnICsgJ1VzZSBcInByb3BzXCIgaW5zdGVhZC4nKTtcbn07XG5cbi8qKlxuICogQXNzZXRzXG4gKlxuICogV2hlbiBhIHZtIGlzIHByZXNlbnQgKGluc3RhbmNlIGNyZWF0aW9uKSwgd2UgbmVlZCB0byBkb1xuICogYSB0aHJlZS13YXkgbWVyZ2UgYmV0d2VlbiBjb25zdHJ1Y3RvciBvcHRpb25zLCBpbnN0YW5jZVxuICogb3B0aW9ucyBhbmQgcGFyZW50IG9wdGlvbnMuXG4gKi9cblxuZnVuY3Rpb24gbWVyZ2VBc3NldHMocGFyZW50VmFsLCBjaGlsZFZhbCkge1xuICB2YXIgcmVzID0gT2JqZWN0LmNyZWF0ZShwYXJlbnRWYWwpO1xuICByZXR1cm4gY2hpbGRWYWwgPyBleHRlbmQocmVzLCBndWFyZEFycmF5QXNzZXRzKGNoaWxkVmFsKSkgOiByZXM7XG59XG5cbmNvbmZpZy5fYXNzZXRUeXBlcy5mb3JFYWNoKGZ1bmN0aW9uICh0eXBlKSB7XG4gIHN0cmF0c1t0eXBlICsgJ3MnXSA9IG1lcmdlQXNzZXRzO1xufSk7XG5cbi8qKlxuICogRXZlbnRzICYgV2F0Y2hlcnMuXG4gKlxuICogRXZlbnRzICYgd2F0Y2hlcnMgaGFzaGVzIHNob3VsZCBub3Qgb3ZlcndyaXRlIG9uZVxuICogYW5vdGhlciwgc28gd2UgbWVyZ2UgdGhlbSBhcyBhcnJheXMuXG4gKi9cblxuc3RyYXRzLndhdGNoID0gc3RyYXRzLmV2ZW50cyA9IGZ1bmN0aW9uIChwYXJlbnRWYWwsIGNoaWxkVmFsKSB7XG4gIGlmICghY2hpbGRWYWwpIHJldHVybiBwYXJlbnRWYWw7XG4gIGlmICghcGFyZW50VmFsKSByZXR1cm4gY2hpbGRWYWw7XG4gIHZhciByZXQgPSB7fTtcbiAgZXh0ZW5kKHJldCwgcGFyZW50VmFsKTtcbiAgZm9yICh2YXIga2V5IGluIGNoaWxkVmFsKSB7XG4gICAgdmFyIHBhcmVudCA9IHJldFtrZXldO1xuICAgIHZhciBjaGlsZCA9IGNoaWxkVmFsW2tleV07XG4gICAgaWYgKHBhcmVudCAmJiAhaXNBcnJheShwYXJlbnQpKSB7XG4gICAgICBwYXJlbnQgPSBbcGFyZW50XTtcbiAgICB9XG4gICAgcmV0W2tleV0gPSBwYXJlbnQgPyBwYXJlbnQuY29uY2F0KGNoaWxkKSA6IFtjaGlsZF07XG4gIH1cbiAgcmV0dXJuIHJldDtcbn07XG5cbi8qKlxuICogT3RoZXIgb2JqZWN0IGhhc2hlcy5cbiAqL1xuXG5zdHJhdHMucHJvcHMgPSBzdHJhdHMubWV0aG9kcyA9IHN0cmF0cy5jb21wdXRlZCA9IGZ1bmN0aW9uIChwYXJlbnRWYWwsIGNoaWxkVmFsKSB7XG4gIGlmICghY2hpbGRWYWwpIHJldHVybiBwYXJlbnRWYWw7XG4gIGlmICghcGFyZW50VmFsKSByZXR1cm4gY2hpbGRWYWw7XG4gIHZhciByZXQgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICBleHRlbmQocmV0LCBwYXJlbnRWYWwpO1xuICBleHRlbmQocmV0LCBjaGlsZFZhbCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG4vKipcbiAqIERlZmF1bHQgc3RyYXRlZ3kuXG4gKi9cblxudmFyIGRlZmF1bHRTdHJhdCA9IGZ1bmN0aW9uIGRlZmF1bHRTdHJhdChwYXJlbnRWYWwsIGNoaWxkVmFsKSB7XG4gIHJldHVybiBjaGlsZFZhbCA9PT0gdW5kZWZpbmVkID8gcGFyZW50VmFsIDogY2hpbGRWYWw7XG59O1xuXG4vKipcbiAqIE1ha2Ugc3VyZSBjb21wb25lbnQgb3B0aW9ucyBnZXQgY29udmVydGVkIHRvIGFjdHVhbFxuICogY29uc3RydWN0b3JzLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKi9cblxuZnVuY3Rpb24gZ3VhcmRDb21wb25lbnRzKG9wdGlvbnMpIHtcbiAgaWYgKG9wdGlvbnMuY29tcG9uZW50cykge1xuICAgIHZhciBjb21wb25lbnRzID0gb3B0aW9ucy5jb21wb25lbnRzID0gZ3VhcmRBcnJheUFzc2V0cyhvcHRpb25zLmNvbXBvbmVudHMpO1xuICAgIHZhciBkZWY7XG4gICAgdmFyIGlkcyA9IE9iamVjdC5rZXlzKGNvbXBvbmVudHMpO1xuICAgIGZvciAodmFyIGkgPSAwLCBsID0gaWRzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgdmFyIGtleSA9IGlkc1tpXTtcbiAgICAgIGlmIChjb21tb25UYWdSRS50ZXN0KGtleSkgfHwgcmVzZXJ2ZWRUYWdSRS50ZXN0KGtleSkpIHtcbiAgICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB3YXJuKCdEbyBub3QgdXNlIGJ1aWx0LWluIG9yIHJlc2VydmVkIEhUTUwgZWxlbWVudHMgYXMgY29tcG9uZW50ICcgKyAnaWQ6ICcgKyBrZXkpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGRlZiA9IGNvbXBvbmVudHNba2V5XTtcbiAgICAgIGlmIChpc1BsYWluT2JqZWN0KGRlZikpIHtcbiAgICAgICAgY29tcG9uZW50c1trZXldID0gVnVlLmV4dGVuZChkZWYpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEVuc3VyZSBhbGwgcHJvcHMgb3B0aW9uIHN5bnRheCBhcmUgbm9ybWFsaXplZCBpbnRvIHRoZVxuICogT2JqZWN0LWJhc2VkIGZvcm1hdC5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICovXG5cbmZ1bmN0aW9uIGd1YXJkUHJvcHMob3B0aW9ucykge1xuICB2YXIgcHJvcHMgPSBvcHRpb25zLnByb3BzO1xuICB2YXIgaSwgdmFsO1xuICBpZiAoaXNBcnJheShwcm9wcykpIHtcbiAgICBvcHRpb25zLnByb3BzID0ge307XG4gICAgaSA9IHByb3BzLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICB2YWwgPSBwcm9wc1tpXTtcbiAgICAgIGlmICh0eXBlb2YgdmFsID09PSAnc3RyaW5nJykge1xuICAgICAgICBvcHRpb25zLnByb3BzW3ZhbF0gPSBudWxsO1xuICAgICAgfSBlbHNlIGlmICh2YWwubmFtZSkge1xuICAgICAgICBvcHRpb25zLnByb3BzW3ZhbC5uYW1lXSA9IHZhbDtcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNQbGFpbk9iamVjdChwcm9wcykpIHtcbiAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHByb3BzKTtcbiAgICBpID0ga2V5cy5sZW5ndGg7XG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgdmFsID0gcHJvcHNba2V5c1tpXV07XG4gICAgICBpZiAodHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBwcm9wc1trZXlzW2ldXSA9IHsgdHlwZTogdmFsIH07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogR3VhcmQgYW4gQXJyYXktZm9ybWF0IGFzc2V0cyBvcHRpb24gYW5kIGNvbnZlcnRlZCBpdFxuICogaW50byB0aGUga2V5LXZhbHVlIE9iamVjdCBmb3JtYXQuXG4gKlxuICogQHBhcmFtIHtPYmplY3R8QXJyYXl9IGFzc2V0c1xuICogQHJldHVybiB7T2JqZWN0fVxuICovXG5cbmZ1bmN0aW9uIGd1YXJkQXJyYXlBc3NldHMoYXNzZXRzKSB7XG4gIGlmIChpc0FycmF5KGFzc2V0cykpIHtcbiAgICB2YXIgcmVzID0ge307XG4gICAgdmFyIGkgPSBhc3NldHMubGVuZ3RoO1xuICAgIHZhciBhc3NldDtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBhc3NldCA9IGFzc2V0c1tpXTtcbiAgICAgIHZhciBpZCA9IHR5cGVvZiBhc3NldCA9PT0gJ2Z1bmN0aW9uJyA/IGFzc2V0Lm9wdGlvbnMgJiYgYXNzZXQub3B0aW9ucy5uYW1lIHx8IGFzc2V0LmlkIDogYXNzZXQubmFtZSB8fCBhc3NldC5pZDtcbiAgICAgIGlmICghaWQpIHtcbiAgICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB3YXJuKCdBcnJheS1zeW50YXggYXNzZXRzIG11c3QgcHJvdmlkZSBhIFwibmFtZVwiIG9yIFwiaWRcIiBmaWVsZC4nKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc1tpZF0gPSBhc3NldDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlcztcbiAgfVxuICByZXR1cm4gYXNzZXRzO1xufVxuXG4vKipcbiAqIE1lcmdlIHR3byBvcHRpb24gb2JqZWN0cyBpbnRvIGEgbmV3IG9uZS5cbiAqIENvcmUgdXRpbGl0eSB1c2VkIGluIGJvdGggaW5zdGFudGlhdGlvbiBhbmQgaW5oZXJpdGFuY2UuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHBhcmVudFxuICogQHBhcmFtIHtPYmplY3R9IGNoaWxkXG4gKiBAcGFyYW0ge1Z1ZX0gW3ZtXSAtIGlmIHZtIGlzIHByZXNlbnQsIGluZGljYXRlcyB0aGlzIGlzXG4gKiAgICAgICAgICAgICAgICAgICAgIGFuIGluc3RhbnRpYXRpb24gbWVyZ2UuXG4gKi9cblxuZnVuY3Rpb24gbWVyZ2VPcHRpb25zKHBhcmVudCwgY2hpbGQsIHZtKSB7XG4gIGd1YXJkQ29tcG9uZW50cyhjaGlsZCk7XG4gIGd1YXJkUHJvcHMoY2hpbGQpO1xuICB2YXIgb3B0aW9ucyA9IHt9O1xuICB2YXIga2V5O1xuICBpZiAoY2hpbGQubWl4aW5zKSB7XG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjaGlsZC5taXhpbnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICBwYXJlbnQgPSBtZXJnZU9wdGlvbnMocGFyZW50LCBjaGlsZC5taXhpbnNbaV0sIHZtKTtcbiAgICB9XG4gIH1cbiAgZm9yIChrZXkgaW4gcGFyZW50KSB7XG4gICAgbWVyZ2VGaWVsZChrZXkpO1xuICB9XG4gIGZvciAoa2V5IGluIGNoaWxkKSB7XG4gICAgaWYgKCFoYXNPd24ocGFyZW50LCBrZXkpKSB7XG4gICAgICBtZXJnZUZpZWxkKGtleSk7XG4gICAgfVxuICB9XG4gIGZ1bmN0aW9uIG1lcmdlRmllbGQoa2V5KSB7XG4gICAgdmFyIHN0cmF0ID0gc3RyYXRzW2tleV0gfHwgZGVmYXVsdFN0cmF0O1xuICAgIG9wdGlvbnNba2V5XSA9IHN0cmF0KHBhcmVudFtrZXldLCBjaGlsZFtrZXldLCB2bSwga2V5KTtcbiAgfVxuICByZXR1cm4gb3B0aW9ucztcbn1cblxuLyoqXG4gKiBSZXNvbHZlIGFuIGFzc2V0LlxuICogVGhpcyBmdW5jdGlvbiBpcyB1c2VkIGJlY2F1c2UgY2hpbGQgaW5zdGFuY2VzIG5lZWQgYWNjZXNzXG4gKiB0byBhc3NldHMgZGVmaW5lZCBpbiBpdHMgYW5jZXN0b3IgY2hhaW4uXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlXG4gKiBAcGFyYW0ge1N0cmluZ30gaWRcbiAqIEByZXR1cm4ge09iamVjdHxGdW5jdGlvbn1cbiAqL1xuXG5mdW5jdGlvbiByZXNvbHZlQXNzZXQob3B0aW9ucywgdHlwZSwgaWQpIHtcbiAgdmFyIGFzc2V0cyA9IG9wdGlvbnNbdHlwZV07XG4gIHZhciBjYW1lbGl6ZWRJZDtcbiAgcmV0dXJuIGFzc2V0c1tpZF0gfHxcbiAgLy8gY2FtZWxDYXNlIElEXG4gIGFzc2V0c1tjYW1lbGl6ZWRJZCA9IGNhbWVsaXplKGlkKV0gfHxcbiAgLy8gUGFzY2FsIENhc2UgSURcbiAgYXNzZXRzW2NhbWVsaXplZElkLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgY2FtZWxpemVkSWQuc2xpY2UoMSldO1xufVxuXG4vKipcbiAqIEFzc2VydCBhc3NldCBleGlzdHNcbiAqL1xuXG5mdW5jdGlvbiBhc3NlcnRBc3NldCh2YWwsIHR5cGUsIGlkKSB7XG4gIGlmICghdmFsKSB7XG4gICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB3YXJuKCdGYWlsZWQgdG8gcmVzb2x2ZSAnICsgdHlwZSArICc6ICcgKyBpZCk7XG4gIH1cbn1cblxudmFyIGFycmF5UHJvdG8gPSBBcnJheS5wcm90b3R5cGU7XG52YXIgYXJyYXlNZXRob2RzID0gT2JqZWN0LmNyZWF0ZShhcnJheVByb3RvKVxuXG4vKipcbiAqIEludGVyY2VwdCBtdXRhdGluZyBtZXRob2RzIGFuZCBlbWl0IGV2ZW50c1xuICovXG5cbjtbJ3B1c2gnLCAncG9wJywgJ3NoaWZ0JywgJ3Vuc2hpZnQnLCAnc3BsaWNlJywgJ3NvcnQnLCAncmV2ZXJzZSddLmZvckVhY2goZnVuY3Rpb24gKG1ldGhvZCkge1xuICAvLyBjYWNoZSBvcmlnaW5hbCBtZXRob2RcbiAgdmFyIG9yaWdpbmFsID0gYXJyYXlQcm90b1ttZXRob2RdO1xuICBkZWYoYXJyYXlNZXRob2RzLCBtZXRob2QsIGZ1bmN0aW9uIG11dGF0b3IoKSB7XG4gICAgLy8gYXZvaWQgbGVha2luZyBhcmd1bWVudHM6XG4gICAgLy8gaHR0cDovL2pzcGVyZi5jb20vY2xvc3VyZS13aXRoLWFyZ3VtZW50c1xuICAgIHZhciBpID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShpKTtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBhcmdzW2ldID0gYXJndW1lbnRzW2ldO1xuICAgIH1cbiAgICB2YXIgcmVzdWx0ID0gb3JpZ2luYWwuYXBwbHkodGhpcywgYXJncyk7XG4gICAgdmFyIG9iID0gdGhpcy5fX29iX187XG4gICAgdmFyIGluc2VydGVkO1xuICAgIHN3aXRjaCAobWV0aG9kKSB7XG4gICAgICBjYXNlICdwdXNoJzpcbiAgICAgICAgaW5zZXJ0ZWQgPSBhcmdzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3Vuc2hpZnQnOlxuICAgICAgICBpbnNlcnRlZCA9IGFyZ3M7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnc3BsaWNlJzpcbiAgICAgICAgaW5zZXJ0ZWQgPSBhcmdzLnNsaWNlKDIpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgaWYgKGluc2VydGVkKSBvYi5vYnNlcnZlQXJyYXkoaW5zZXJ0ZWQpO1xuICAgIC8vIG5vdGlmeSBjaGFuZ2VcbiAgICBvYi5kZXAubm90aWZ5KCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSk7XG59KTtcblxuLyoqXG4gKiBTd2FwIHRoZSBlbGVtZW50IGF0IHRoZSBnaXZlbiBpbmRleCB3aXRoIGEgbmV3IHZhbHVlXG4gKiBhbmQgZW1pdHMgY29ycmVzcG9uZGluZyBldmVudC5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gaW5kZXhcbiAqIEBwYXJhbSB7Kn0gdmFsXG4gKiBAcmV0dXJuIHsqfSAtIHJlcGxhY2VkIGVsZW1lbnRcbiAqL1xuXG5kZWYoYXJyYXlQcm90bywgJyRzZXQnLCBmdW5jdGlvbiAkc2V0KGluZGV4LCB2YWwpIHtcbiAgaWYgKGluZGV4ID49IHRoaXMubGVuZ3RoKSB7XG4gICAgdGhpcy5sZW5ndGggPSBOdW1iZXIoaW5kZXgpICsgMTtcbiAgfVxuICByZXR1cm4gdGhpcy5zcGxpY2UoaW5kZXgsIDEsIHZhbClbMF07XG59KTtcblxuLyoqXG4gKiBDb252ZW5pZW5jZSBtZXRob2QgdG8gcmVtb3ZlIHRoZSBlbGVtZW50IGF0IGdpdmVuIGluZGV4LlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBpbmRleFxuICogQHBhcmFtIHsqfSB2YWxcbiAqL1xuXG5kZWYoYXJyYXlQcm90bywgJyRyZW1vdmUnLCBmdW5jdGlvbiAkcmVtb3ZlKGl0ZW0pIHtcbiAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gIGlmICghdGhpcy5sZW5ndGgpIHJldHVybjtcbiAgdmFyIGluZGV4ID0gaW5kZXhPZih0aGlzLCBpdGVtKTtcbiAgaWYgKGluZGV4ID4gLTEpIHtcbiAgICByZXR1cm4gdGhpcy5zcGxpY2UoaW5kZXgsIDEpO1xuICB9XG59KTtcblxudmFyIHVpZCQzID0gMDtcblxuLyoqXG4gKiBBIGRlcCBpcyBhbiBvYnNlcnZhYmxlIHRoYXQgY2FuIGhhdmUgbXVsdGlwbGVcbiAqIGRpcmVjdGl2ZXMgc3Vic2NyaWJpbmcgdG8gaXQuXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIERlcCgpIHtcbiAgdGhpcy5pZCA9IHVpZCQzKys7XG4gIHRoaXMuc3VicyA9IFtdO1xufVxuXG4vLyB0aGUgY3VycmVudCB0YXJnZXQgd2F0Y2hlciBiZWluZyBldmFsdWF0ZWQuXG4vLyB0aGlzIGlzIGdsb2JhbGx5IHVuaXF1ZSBiZWNhdXNlIHRoZXJlIGNvdWxkIGJlIG9ubHkgb25lXG4vLyB3YXRjaGVyIGJlaW5nIGV2YWx1YXRlZCBhdCBhbnkgdGltZS5cbkRlcC50YXJnZXQgPSBudWxsO1xuXG4vKipcbiAqIEFkZCBhIGRpcmVjdGl2ZSBzdWJzY3JpYmVyLlxuICpcbiAqIEBwYXJhbSB7RGlyZWN0aXZlfSBzdWJcbiAqL1xuXG5EZXAucHJvdG90eXBlLmFkZFN1YiA9IGZ1bmN0aW9uIChzdWIpIHtcbiAgdGhpcy5zdWJzLnB1c2goc3ViKTtcbn07XG5cbi8qKlxuICogUmVtb3ZlIGEgZGlyZWN0aXZlIHN1YnNjcmliZXIuXG4gKlxuICogQHBhcmFtIHtEaXJlY3RpdmV9IHN1YlxuICovXG5cbkRlcC5wcm90b3R5cGUucmVtb3ZlU3ViID0gZnVuY3Rpb24gKHN1Yikge1xuICB0aGlzLnN1YnMuJHJlbW92ZShzdWIpO1xufTtcblxuLyoqXG4gKiBBZGQgc2VsZiBhcyBhIGRlcGVuZGVuY3kgdG8gdGhlIHRhcmdldCB3YXRjaGVyLlxuICovXG5cbkRlcC5wcm90b3R5cGUuZGVwZW5kID0gZnVuY3Rpb24gKCkge1xuICBEZXAudGFyZ2V0LmFkZERlcCh0aGlzKTtcbn07XG5cbi8qKlxuICogTm90aWZ5IGFsbCBzdWJzY3JpYmVycyBvZiBhIG5ldyB2YWx1ZS5cbiAqL1xuXG5EZXAucHJvdG90eXBlLm5vdGlmeSA9IGZ1bmN0aW9uICgpIHtcbiAgLy8gc3RhYmxpemUgdGhlIHN1YnNjcmliZXIgbGlzdCBmaXJzdFxuICB2YXIgc3VicyA9IHRvQXJyYXkodGhpcy5zdWJzKTtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSBzdWJzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIHN1YnNbaV0udXBkYXRlKCk7XG4gIH1cbn07XG5cbnZhciBhcnJheUtleXMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhhcnJheU1ldGhvZHMpO1xuXG4vKipcbiAqIE9ic2VydmVyIGNsYXNzIHRoYXQgYXJlIGF0dGFjaGVkIHRvIGVhY2ggb2JzZXJ2ZWRcbiAqIG9iamVjdC4gT25jZSBhdHRhY2hlZCwgdGhlIG9ic2VydmVyIGNvbnZlcnRzIHRhcmdldFxuICogb2JqZWN0J3MgcHJvcGVydHkga2V5cyBpbnRvIGdldHRlci9zZXR0ZXJzIHRoYXRcbiAqIGNvbGxlY3QgZGVwZW5kZW5jaWVzIGFuZCBkaXNwYXRjaGVzIHVwZGF0ZXMuXG4gKlxuICogQHBhcmFtIHtBcnJheXxPYmplY3R9IHZhbHVlXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuXG5mdW5jdGlvbiBPYnNlcnZlcih2YWx1ZSkge1xuICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gIHRoaXMuZGVwID0gbmV3IERlcCgpO1xuICBkZWYodmFsdWUsICdfX29iX18nLCB0aGlzKTtcbiAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgdmFyIGF1Z21lbnQgPSBoYXNQcm90byA/IHByb3RvQXVnbWVudCA6IGNvcHlBdWdtZW50O1xuICAgIGF1Z21lbnQodmFsdWUsIGFycmF5TWV0aG9kcywgYXJyYXlLZXlzKTtcbiAgICB0aGlzLm9ic2VydmVBcnJheSh2YWx1ZSk7XG4gIH0gZWxzZSB7XG4gICAgdGhpcy53YWxrKHZhbHVlKTtcbiAgfVxufVxuXG4vLyBJbnN0YW5jZSBtZXRob2RzXG5cbi8qKlxuICogV2FsayB0aHJvdWdoIGVhY2ggcHJvcGVydHkgYW5kIGNvbnZlcnQgdGhlbSBpbnRvXG4gKiBnZXR0ZXIvc2V0dGVycy4gVGhpcyBtZXRob2Qgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIHdoZW5cbiAqIHZhbHVlIHR5cGUgaXMgT2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcbiAqL1xuXG5PYnNlcnZlci5wcm90b3R5cGUud2FsayA9IGZ1bmN0aW9uIChvYmopIHtcbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhvYmopO1xuICBmb3IgKHZhciBpID0gMCwgbCA9IGtleXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgdGhpcy5jb252ZXJ0KGtleXNbaV0sIG9ialtrZXlzW2ldXSk7XG4gIH1cbn07XG5cbi8qKlxuICogT2JzZXJ2ZSBhIGxpc3Qgb2YgQXJyYXkgaXRlbXMuXG4gKlxuICogQHBhcmFtIHtBcnJheX0gaXRlbXNcbiAqL1xuXG5PYnNlcnZlci5wcm90b3R5cGUub2JzZXJ2ZUFycmF5ID0gZnVuY3Rpb24gKGl0ZW1zKSB7XG4gIGZvciAodmFyIGkgPSAwLCBsID0gaXRlbXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgb2JzZXJ2ZShpdGVtc1tpXSk7XG4gIH1cbn07XG5cbi8qKlxuICogQ29udmVydCBhIHByb3BlcnR5IGludG8gZ2V0dGVyL3NldHRlciBzbyB3ZSBjYW4gZW1pdFxuICogdGhlIGV2ZW50cyB3aGVuIHRoZSBwcm9wZXJ0eSBpcyBhY2Nlc3NlZC9jaGFuZ2VkLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBrZXlcbiAqIEBwYXJhbSB7Kn0gdmFsXG4gKi9cblxuT2JzZXJ2ZXIucHJvdG90eXBlLmNvbnZlcnQgPSBmdW5jdGlvbiAoa2V5LCB2YWwpIHtcbiAgZGVmaW5lUmVhY3RpdmUodGhpcy52YWx1ZSwga2V5LCB2YWwpO1xufTtcblxuLyoqXG4gKiBBZGQgYW4gb3duZXIgdm0sIHNvIHRoYXQgd2hlbiAkc2V0LyRkZWxldGUgbXV0YXRpb25zXG4gKiBoYXBwZW4gd2UgY2FuIG5vdGlmeSBvd25lciB2bXMgdG8gcHJveHkgdGhlIGtleXMgYW5kXG4gKiBkaWdlc3QgdGhlIHdhdGNoZXJzLiBUaGlzIGlzIG9ubHkgY2FsbGVkIHdoZW4gdGhlIG9iamVjdFxuICogaXMgb2JzZXJ2ZWQgYXMgYW4gaW5zdGFuY2UncyByb290ICRkYXRhLlxuICpcbiAqIEBwYXJhbSB7VnVlfSB2bVxuICovXG5cbk9ic2VydmVyLnByb3RvdHlwZS5hZGRWbSA9IGZ1bmN0aW9uICh2bSkge1xuICAodGhpcy52bXMgfHwgKHRoaXMudm1zID0gW10pKS5wdXNoKHZtKTtcbn07XG5cbi8qKlxuICogUmVtb3ZlIGFuIG93bmVyIHZtLiBUaGlzIGlzIGNhbGxlZCB3aGVuIHRoZSBvYmplY3QgaXNcbiAqIHN3YXBwZWQgb3V0IGFzIGFuIGluc3RhbmNlJ3MgJGRhdGEgb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7VnVlfSB2bVxuICovXG5cbk9ic2VydmVyLnByb3RvdHlwZS5yZW1vdmVWbSA9IGZ1bmN0aW9uICh2bSkge1xuICB0aGlzLnZtcy4kcmVtb3ZlKHZtKTtcbn07XG5cbi8vIGhlbHBlcnNcblxuLyoqXG4gKiBBdWdtZW50IGFuIHRhcmdldCBPYmplY3Qgb3IgQXJyYXkgYnkgaW50ZXJjZXB0aW5nXG4gKiB0aGUgcHJvdG90eXBlIGNoYWluIHVzaW5nIF9fcHJvdG9fX1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0fEFycmF5fSB0YXJnZXRcbiAqIEBwYXJhbSB7T2JqZWN0fSBwcm90b1xuICovXG5cbmZ1bmN0aW9uIHByb3RvQXVnbWVudCh0YXJnZXQsIHNyYykge1xuICB0YXJnZXQuX19wcm90b19fID0gc3JjO1xufVxuXG4vKipcbiAqIEF1Z21lbnQgYW4gdGFyZ2V0IE9iamVjdCBvciBBcnJheSBieSBkZWZpbmluZ1xuICogaGlkZGVuIHByb3BlcnRpZXMuXG4gKlxuICogQHBhcmFtIHtPYmplY3R8QXJyYXl9IHRhcmdldFxuICogQHBhcmFtIHtPYmplY3R9IHByb3RvXG4gKi9cblxuZnVuY3Rpb24gY29weUF1Z21lbnQodGFyZ2V0LCBzcmMsIGtleXMpIHtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSBrZXlzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIHZhciBrZXkgPSBrZXlzW2ldO1xuICAgIGRlZih0YXJnZXQsIGtleSwgc3JjW2tleV0pO1xuICB9XG59XG5cbi8qKlxuICogQXR0ZW1wdCB0byBjcmVhdGUgYW4gb2JzZXJ2ZXIgaW5zdGFuY2UgZm9yIGEgdmFsdWUsXG4gKiByZXR1cm5zIHRoZSBuZXcgb2JzZXJ2ZXIgaWYgc3VjY2Vzc2Z1bGx5IG9ic2VydmVkLFxuICogb3IgdGhlIGV4aXN0aW5nIG9ic2VydmVyIGlmIHRoZSB2YWx1ZSBhbHJlYWR5IGhhcyBvbmUuXG4gKlxuICogQHBhcmFtIHsqfSB2YWx1ZVxuICogQHBhcmFtIHtWdWV9IFt2bV1cbiAqIEByZXR1cm4ge09ic2VydmVyfHVuZGVmaW5lZH1cbiAqIEBzdGF0aWNcbiAqL1xuXG5mdW5jdGlvbiBvYnNlcnZlKHZhbHVlLCB2bSkge1xuICBpZiAoIXZhbHVlIHx8IHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIG9iO1xuICBpZiAoaGFzT3duKHZhbHVlLCAnX19vYl9fJykgJiYgdmFsdWUuX19vYl9fIGluc3RhbmNlb2YgT2JzZXJ2ZXIpIHtcbiAgICBvYiA9IHZhbHVlLl9fb2JfXztcbiAgfSBlbHNlIGlmICgoaXNBcnJheSh2YWx1ZSkgfHwgaXNQbGFpbk9iamVjdCh2YWx1ZSkpICYmIE9iamVjdC5pc0V4dGVuc2libGUodmFsdWUpICYmICF2YWx1ZS5faXNWdWUpIHtcbiAgICBvYiA9IG5ldyBPYnNlcnZlcih2YWx1ZSk7XG4gIH1cbiAgaWYgKG9iICYmIHZtKSB7XG4gICAgb2IuYWRkVm0odm0pO1xuICB9XG4gIHJldHVybiBvYjtcbn1cblxuLyoqXG4gKiBEZWZpbmUgYSByZWFjdGl2ZSBwcm9wZXJ0eSBvbiBhbiBPYmplY3QuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9ialxuICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICogQHBhcmFtIHsqfSB2YWxcbiAqL1xuXG5mdW5jdGlvbiBkZWZpbmVSZWFjdGl2ZShvYmosIGtleSwgdmFsKSB7XG4gIHZhciBkZXAgPSBuZXcgRGVwKCk7XG5cbiAgLy8gY2F0ZXIgZm9yIHByZS1kZWZpbmVkIGdldHRlci9zZXR0ZXJzXG4gIHZhciBnZXR0ZXIsIHNldHRlcjtcbiAgaWYgKGNvbmZpZy5jb252ZXJ0QWxsUHJvcGVydGllcykge1xuICAgIHZhciBwcm9wZXJ0eSA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Iob2JqLCBrZXkpO1xuICAgIGlmIChwcm9wZXJ0eSAmJiBwcm9wZXJ0eS5jb25maWd1cmFibGUgPT09IGZhbHNlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGdldHRlciA9IHByb3BlcnR5ICYmIHByb3BlcnR5LmdldDtcbiAgICBzZXR0ZXIgPSBwcm9wZXJ0eSAmJiBwcm9wZXJ0eS5zZXQ7XG4gIH1cblxuICB2YXIgY2hpbGRPYiA9IG9ic2VydmUodmFsKTtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwga2V5LCB7XG4gICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgZ2V0OiBmdW5jdGlvbiByZWFjdGl2ZUdldHRlcigpIHtcbiAgICAgIHZhciB2YWx1ZSA9IGdldHRlciA/IGdldHRlci5jYWxsKG9iaikgOiB2YWw7XG4gICAgICBpZiAoRGVwLnRhcmdldCkge1xuICAgICAgICBkZXAuZGVwZW5kKCk7XG4gICAgICAgIGlmIChjaGlsZE9iKSB7XG4gICAgICAgICAgY2hpbGRPYi5kZXAuZGVwZW5kKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgICAgZm9yICh2YXIgZSwgaSA9IDAsIGwgPSB2YWx1ZS5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIGUgPSB2YWx1ZVtpXTtcbiAgICAgICAgICAgIGUgJiYgZS5fX29iX18gJiYgZS5fX29iX18uZGVwLmRlcGVuZCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiByZWFjdGl2ZVNldHRlcihuZXdWYWwpIHtcbiAgICAgIHZhciB2YWx1ZSA9IGdldHRlciA/IGdldHRlci5jYWxsKG9iaikgOiB2YWw7XG4gICAgICBpZiAobmV3VmFsID09PSB2YWx1ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoc2V0dGVyKSB7XG4gICAgICAgIHNldHRlci5jYWxsKG9iaiwgbmV3VmFsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbCA9IG5ld1ZhbDtcbiAgICAgIH1cbiAgICAgIGNoaWxkT2IgPSBvYnNlcnZlKG5ld1ZhbCk7XG4gICAgICBkZXAubm90aWZ5KCk7XG4gICAgfVxuICB9KTtcbn1cblxudmFyIHV0aWwgPSBPYmplY3QuZnJlZXplKHtcblx0ZGVmaW5lUmVhY3RpdmU6IGRlZmluZVJlYWN0aXZlLFxuXHRzZXQ6IHNldCxcblx0ZGVsOiBkZWwsXG5cdGhhc093bjogaGFzT3duLFxuXHRpc0xpdGVyYWw6IGlzTGl0ZXJhbCxcblx0aXNSZXNlcnZlZDogaXNSZXNlcnZlZCxcblx0X3RvU3RyaW5nOiBfdG9TdHJpbmcsXG5cdHRvTnVtYmVyOiB0b051bWJlcixcblx0dG9Cb29sZWFuOiB0b0Jvb2xlYW4sXG5cdHN0cmlwUXVvdGVzOiBzdHJpcFF1b3Rlcyxcblx0Y2FtZWxpemU6IGNhbWVsaXplLFxuXHRoeXBoZW5hdGU6IGh5cGhlbmF0ZSxcblx0Y2xhc3NpZnk6IGNsYXNzaWZ5LFxuXHRiaW5kOiBiaW5kJDEsXG5cdHRvQXJyYXk6IHRvQXJyYXksXG5cdGV4dGVuZDogZXh0ZW5kLFxuXHRpc09iamVjdDogaXNPYmplY3QsXG5cdGlzUGxhaW5PYmplY3Q6IGlzUGxhaW5PYmplY3QsXG5cdGRlZjogZGVmLFxuXHRkZWJvdW5jZTogX2RlYm91bmNlLFxuXHRpbmRleE9mOiBpbmRleE9mLFxuXHRjYW5jZWxsYWJsZTogY2FuY2VsbGFibGUsXG5cdGxvb3NlRXF1YWw6IGxvb3NlRXF1YWwsXG5cdGlzQXJyYXk6IGlzQXJyYXksXG5cdGhhc1Byb3RvOiBoYXNQcm90byxcblx0aW5Ccm93c2VyOiBpbkJyb3dzZXIsXG5cdGlzSUU5OiBpc0lFOSxcblx0aXNBbmRyb2lkOiBpc0FuZHJvaWQsXG5cdGdldCB0cmFuc2l0aW9uUHJvcCAoKSB7IHJldHVybiB0cmFuc2l0aW9uUHJvcDsgfSxcblx0Z2V0IHRyYW5zaXRpb25FbmRFdmVudCAoKSB7IHJldHVybiB0cmFuc2l0aW9uRW5kRXZlbnQ7IH0sXG5cdGdldCBhbmltYXRpb25Qcm9wICgpIHsgcmV0dXJuIGFuaW1hdGlvblByb3A7IH0sXG5cdGdldCBhbmltYXRpb25FbmRFdmVudCAoKSB7IHJldHVybiBhbmltYXRpb25FbmRFdmVudDsgfSxcblx0bmV4dFRpY2s6IG5leHRUaWNrLFxuXHRxdWVyeTogcXVlcnksXG5cdGluRG9jOiBpbkRvYyxcblx0Z2V0QXR0cjogZ2V0QXR0cixcblx0Z2V0QmluZEF0dHI6IGdldEJpbmRBdHRyLFxuXHRoYXNCaW5kQXR0cjogaGFzQmluZEF0dHIsXG5cdGJlZm9yZTogYmVmb3JlLFxuXHRhZnRlcjogYWZ0ZXIsXG5cdHJlbW92ZTogcmVtb3ZlLFxuXHRwcmVwZW5kOiBwcmVwZW5kLFxuXHRyZXBsYWNlOiByZXBsYWNlLFxuXHRvbjogb24kMSxcblx0b2ZmOiBvZmYsXG5cdHNldENsYXNzOiBzZXRDbGFzcyxcblx0YWRkQ2xhc3M6IGFkZENsYXNzLFxuXHRyZW1vdmVDbGFzczogcmVtb3ZlQ2xhc3MsXG5cdGV4dHJhY3RDb250ZW50OiBleHRyYWN0Q29udGVudCxcblx0dHJpbU5vZGU6IHRyaW1Ob2RlLFxuXHRpc1RlbXBsYXRlOiBpc1RlbXBsYXRlLFxuXHRjcmVhdGVBbmNob3I6IGNyZWF0ZUFuY2hvcixcblx0ZmluZFJlZjogZmluZFJlZixcblx0bWFwTm9kZVJhbmdlOiBtYXBOb2RlUmFuZ2UsXG5cdHJlbW92ZU5vZGVSYW5nZTogcmVtb3ZlTm9kZVJhbmdlLFxuXHRtZXJnZU9wdGlvbnM6IG1lcmdlT3B0aW9ucyxcblx0cmVzb2x2ZUFzc2V0OiByZXNvbHZlQXNzZXQsXG5cdGFzc2VydEFzc2V0OiBhc3NlcnRBc3NldCxcblx0Y2hlY2tDb21wb25lbnRBdHRyOiBjaGVja0NvbXBvbmVudEF0dHIsXG5cdGluaXRQcm9wOiBpbml0UHJvcCxcblx0YXNzZXJ0UHJvcDogYXNzZXJ0UHJvcCxcblx0Y29lcmNlUHJvcDogY29lcmNlUHJvcCxcblx0Y29tbW9uVGFnUkU6IGNvbW1vblRhZ1JFLFxuXHRyZXNlcnZlZFRhZ1JFOiByZXNlcnZlZFRhZ1JFLFxuXHRnZXQgd2FybiAoKSB7IHJldHVybiB3YXJuOyB9XG59KTtcblxudmFyIHVpZCA9IDA7XG5cbmZ1bmN0aW9uIGluaXRNaXhpbiAoVnVlKSB7XG5cbiAgLyoqXG4gICAqIFRoZSBtYWluIGluaXQgc2VxdWVuY2UuIFRoaXMgaXMgY2FsbGVkIGZvciBldmVyeVxuICAgKiBpbnN0YW5jZSwgaW5jbHVkaW5nIG9uZXMgdGhhdCBhcmUgY3JlYXRlZCBmcm9tIGV4dGVuZGVkXG4gICAqIGNvbnN0cnVjdG9ycy5cbiAgICpcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgLSB0aGlzIG9wdGlvbnMgb2JqZWN0IHNob3VsZCBiZVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoZSByZXN1bHQgb2YgbWVyZ2luZyBjbGFzc1xuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMgYW5kIHRoZSBvcHRpb25zIHBhc3NlZFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgIGluIHRvIHRoZSBjb25zdHJ1Y3Rvci5cbiAgICovXG5cbiAgVnVlLnByb3RvdHlwZS5faW5pdCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG5cbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAgIHRoaXMuJGVsID0gbnVsbDtcbiAgICB0aGlzLiRwYXJlbnQgPSBvcHRpb25zLnBhcmVudDtcbiAgICB0aGlzLiRyb290ID0gdGhpcy4kcGFyZW50ID8gdGhpcy4kcGFyZW50LiRyb290IDogdGhpcztcbiAgICB0aGlzLiRjaGlsZHJlbiA9IFtdO1xuICAgIHRoaXMuJHJlZnMgPSB7fTsgLy8gY2hpbGQgdm0gcmVmZXJlbmNlc1xuICAgIHRoaXMuJGVscyA9IHt9OyAvLyBlbGVtZW50IHJlZmVyZW5jZXNcbiAgICB0aGlzLl93YXRjaGVycyA9IFtdOyAvLyBhbGwgd2F0Y2hlcnMgYXMgYW4gYXJyYXlcbiAgICB0aGlzLl9kaXJlY3RpdmVzID0gW107IC8vIGFsbCBkaXJlY3RpdmVzXG5cbiAgICAvLyBhIHVpZFxuICAgIHRoaXMuX3VpZCA9IHVpZCsrO1xuXG4gICAgLy8gYSBmbGFnIHRvIGF2b2lkIHRoaXMgYmVpbmcgb2JzZXJ2ZWRcbiAgICB0aGlzLl9pc1Z1ZSA9IHRydWU7XG5cbiAgICAvLyBldmVudHMgYm9va2tlZXBpbmdcbiAgICB0aGlzLl9ldmVudHMgPSB7fTsgLy8gcmVnaXN0ZXJlZCBjYWxsYmFja3NcbiAgICB0aGlzLl9ldmVudHNDb3VudCA9IHt9OyAvLyBmb3IgJGJyb2FkY2FzdCBvcHRpbWl6YXRpb25cblxuICAgIC8vIGZyYWdtZW50IGluc3RhbmNlIHByb3BlcnRpZXNcbiAgICB0aGlzLl9pc0ZyYWdtZW50ID0gZmFsc2U7XG4gICAgdGhpcy5fZnJhZ21lbnQgPSAvLyBAdHlwZSB7RG9jdW1lbnRGcmFnbWVudH1cbiAgICB0aGlzLl9mcmFnbWVudFN0YXJ0ID0gLy8gQHR5cGUge1RleHR8Q29tbWVudH1cbiAgICB0aGlzLl9mcmFnbWVudEVuZCA9IG51bGw7IC8vIEB0eXBlIHtUZXh0fENvbW1lbnR9XG5cbiAgICAvLyBsaWZlY3ljbGUgc3RhdGVcbiAgICB0aGlzLl9pc0NvbXBpbGVkID0gdGhpcy5faXNEZXN0cm95ZWQgPSB0aGlzLl9pc1JlYWR5ID0gdGhpcy5faXNBdHRhY2hlZCA9IHRoaXMuX2lzQmVpbmdEZXN0cm95ZWQgPSBmYWxzZTtcbiAgICB0aGlzLl91bmxpbmtGbiA9IG51bGw7XG5cbiAgICAvLyBjb250ZXh0OlxuICAgIC8vIGlmIHRoaXMgaXMgYSB0cmFuc2NsdWRlZCBjb21wb25lbnQsIGNvbnRleHRcbiAgICAvLyB3aWxsIGJlIHRoZSBjb21tb24gcGFyZW50IHZtIG9mIHRoaXMgaW5zdGFuY2VcbiAgICAvLyBhbmQgaXRzIGhvc3QuXG4gICAgdGhpcy5fY29udGV4dCA9IG9wdGlvbnMuX2NvbnRleHQgfHwgdGhpcy4kcGFyZW50O1xuXG4gICAgLy8gc2NvcGU6XG4gICAgLy8gaWYgdGhpcyBpcyBpbnNpZGUgYW4gaW5saW5lIHYtZm9yLCB0aGUgc2NvcGVcbiAgICAvLyB3aWxsIGJlIHRoZSBpbnRlcm1lZGlhdGUgc2NvcGUgY3JlYXRlZCBmb3IgdGhpc1xuICAgIC8vIHJlcGVhdCBmcmFnbWVudC4gdGhpcyBpcyB1c2VkIGZvciBsaW5raW5nIHByb3BzXG4gICAgLy8gYW5kIGNvbnRhaW5lciBkaXJlY3RpdmVzLlxuICAgIHRoaXMuX3Njb3BlID0gb3B0aW9ucy5fc2NvcGU7XG5cbiAgICAvLyBmcmFnbWVudDpcbiAgICAvLyBpZiB0aGlzIGluc3RhbmNlIGlzIGNvbXBpbGVkIGluc2lkZSBhIEZyYWdtZW50LCBpdFxuICAgIC8vIG5lZWRzIHRvIHJlaWdzdGVyIGl0c2VsZiBhcyBhIGNoaWxkIG9mIHRoYXQgZnJhZ21lbnRcbiAgICAvLyBmb3IgYXR0YWNoL2RldGFjaCB0byB3b3JrIHByb3Blcmx5LlxuICAgIHRoaXMuX2ZyYWcgPSBvcHRpb25zLl9mcmFnO1xuICAgIGlmICh0aGlzLl9mcmFnKSB7XG4gICAgICB0aGlzLl9mcmFnLmNoaWxkcmVuLnB1c2godGhpcyk7XG4gICAgfVxuXG4gICAgLy8gcHVzaCBzZWxmIGludG8gcGFyZW50IC8gdHJhbnNjbHVzaW9uIGhvc3RcbiAgICBpZiAodGhpcy4kcGFyZW50KSB7XG4gICAgICB0aGlzLiRwYXJlbnQuJGNoaWxkcmVuLnB1c2godGhpcyk7XG4gICAgfVxuXG4gICAgLy8gbWVyZ2Ugb3B0aW9ucy5cbiAgICBvcHRpb25zID0gdGhpcy4kb3B0aW9ucyA9IG1lcmdlT3B0aW9ucyh0aGlzLmNvbnN0cnVjdG9yLm9wdGlvbnMsIG9wdGlvbnMsIHRoaXMpO1xuXG4gICAgLy8gc2V0IHJlZlxuICAgIHRoaXMuX3VwZGF0ZVJlZigpO1xuXG4gICAgLy8gaW5pdGlhbGl6ZSBkYXRhIGFzIGVtcHR5IG9iamVjdC5cbiAgICAvLyBpdCB3aWxsIGJlIGZpbGxlZCB1cCBpbiBfaW5pdFNjb3BlKCkuXG4gICAgdGhpcy5fZGF0YSA9IHt9O1xuXG4gICAgLy8gY2FsbCBpbml0IGhvb2tcbiAgICB0aGlzLl9jYWxsSG9vaygnaW5pdCcpO1xuXG4gICAgLy8gaW5pdGlhbGl6ZSBkYXRhIG9ic2VydmF0aW9uIGFuZCBzY29wZSBpbmhlcml0YW5jZS5cbiAgICB0aGlzLl9pbml0U3RhdGUoKTtcblxuICAgIC8vIHNldHVwIGV2ZW50IHN5c3RlbSBhbmQgb3B0aW9uIGV2ZW50cy5cbiAgICB0aGlzLl9pbml0RXZlbnRzKCk7XG5cbiAgICAvLyBjYWxsIGNyZWF0ZWQgaG9va1xuICAgIHRoaXMuX2NhbGxIb29rKCdjcmVhdGVkJyk7XG5cbiAgICAvLyBpZiBgZWxgIG9wdGlvbiBpcyBwYXNzZWQsIHN0YXJ0IGNvbXBpbGF0aW9uLlxuICAgIGlmIChvcHRpb25zLmVsKSB7XG4gICAgICB0aGlzLiRtb3VudChvcHRpb25zLmVsKTtcbiAgICB9XG4gIH07XG59XG5cbnZhciBwYXRoQ2FjaGUgPSBuZXcgQ2FjaGUoMTAwMCk7XG5cbi8vIGFjdGlvbnNcbnZhciBBUFBFTkQgPSAwO1xudmFyIFBVU0ggPSAxO1xudmFyIElOQ19TVUJfUEFUSF9ERVBUSCA9IDI7XG52YXIgUFVTSF9TVUJfUEFUSCA9IDM7XG5cbi8vIHN0YXRlc1xudmFyIEJFRk9SRV9QQVRIID0gMDtcbnZhciBJTl9QQVRIID0gMTtcbnZhciBCRUZPUkVfSURFTlQgPSAyO1xudmFyIElOX0lERU5UID0gMztcbnZhciBJTl9TVUJfUEFUSCA9IDQ7XG52YXIgSU5fU0lOR0xFX1FVT1RFID0gNTtcbnZhciBJTl9ET1VCTEVfUVVPVEUgPSA2O1xudmFyIEFGVEVSX1BBVEggPSA3O1xudmFyIEVSUk9SID0gODtcblxudmFyIHBhdGhTdGF0ZU1hY2hpbmUgPSBbXTtcblxucGF0aFN0YXRlTWFjaGluZVtCRUZPUkVfUEFUSF0gPSB7XG4gICd3cyc6IFtCRUZPUkVfUEFUSF0sXG4gICdpZGVudCc6IFtJTl9JREVOVCwgQVBQRU5EXSxcbiAgJ1snOiBbSU5fU1VCX1BBVEhdLFxuICAnZW9mJzogW0FGVEVSX1BBVEhdXG59O1xuXG5wYXRoU3RhdGVNYWNoaW5lW0lOX1BBVEhdID0ge1xuICAnd3MnOiBbSU5fUEFUSF0sXG4gICcuJzogW0JFRk9SRV9JREVOVF0sXG4gICdbJzogW0lOX1NVQl9QQVRIXSxcbiAgJ2VvZic6IFtBRlRFUl9QQVRIXVxufTtcblxucGF0aFN0YXRlTWFjaGluZVtCRUZPUkVfSURFTlRdID0ge1xuICAnd3MnOiBbQkVGT1JFX0lERU5UXSxcbiAgJ2lkZW50JzogW0lOX0lERU5ULCBBUFBFTkRdXG59O1xuXG5wYXRoU3RhdGVNYWNoaW5lW0lOX0lERU5UXSA9IHtcbiAgJ2lkZW50JzogW0lOX0lERU5ULCBBUFBFTkRdLFxuICAnMCc6IFtJTl9JREVOVCwgQVBQRU5EXSxcbiAgJ251bWJlcic6IFtJTl9JREVOVCwgQVBQRU5EXSxcbiAgJ3dzJzogW0lOX1BBVEgsIFBVU0hdLFxuICAnLic6IFtCRUZPUkVfSURFTlQsIFBVU0hdLFxuICAnWyc6IFtJTl9TVUJfUEFUSCwgUFVTSF0sXG4gICdlb2YnOiBbQUZURVJfUEFUSCwgUFVTSF1cbn07XG5cbnBhdGhTdGF0ZU1hY2hpbmVbSU5fU1VCX1BBVEhdID0ge1xuICBcIidcIjogW0lOX1NJTkdMRV9RVU9URSwgQVBQRU5EXSxcbiAgJ1wiJzogW0lOX0RPVUJMRV9RVU9URSwgQVBQRU5EXSxcbiAgJ1snOiBbSU5fU1VCX1BBVEgsIElOQ19TVUJfUEFUSF9ERVBUSF0sXG4gICddJzogW0lOX1BBVEgsIFBVU0hfU1VCX1BBVEhdLFxuICAnZW9mJzogRVJST1IsXG4gICdlbHNlJzogW0lOX1NVQl9QQVRILCBBUFBFTkRdXG59O1xuXG5wYXRoU3RhdGVNYWNoaW5lW0lOX1NJTkdMRV9RVU9URV0gPSB7XG4gIFwiJ1wiOiBbSU5fU1VCX1BBVEgsIEFQUEVORF0sXG4gICdlb2YnOiBFUlJPUixcbiAgJ2Vsc2UnOiBbSU5fU0lOR0xFX1FVT1RFLCBBUFBFTkRdXG59O1xuXG5wYXRoU3RhdGVNYWNoaW5lW0lOX0RPVUJMRV9RVU9URV0gPSB7XG4gICdcIic6IFtJTl9TVUJfUEFUSCwgQVBQRU5EXSxcbiAgJ2VvZic6IEVSUk9SLFxuICAnZWxzZSc6IFtJTl9ET1VCTEVfUVVPVEUsIEFQUEVORF1cbn07XG5cbi8qKlxuICogRGV0ZXJtaW5lIHRoZSB0eXBlIG9mIGEgY2hhcmFjdGVyIGluIGEga2V5cGF0aC5cbiAqXG4gKiBAcGFyYW0ge0NoYXJ9IGNoXG4gKiBAcmV0dXJuIHtTdHJpbmd9IHR5cGVcbiAqL1xuXG5mdW5jdGlvbiBnZXRQYXRoQ2hhclR5cGUoY2gpIHtcbiAgaWYgKGNoID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gJ2VvZic7XG4gIH1cblxuICB2YXIgY29kZSA9IGNoLmNoYXJDb2RlQXQoMCk7XG5cbiAgc3dpdGNoIChjb2RlKSB7XG4gICAgY2FzZSAweDVCOiAvLyBbXG4gICAgY2FzZSAweDVEOiAvLyBdXG4gICAgY2FzZSAweDJFOiAvLyAuXG4gICAgY2FzZSAweDIyOiAvLyBcIlxuICAgIGNhc2UgMHgyNzogLy8gJ1xuICAgIGNhc2UgMHgzMDpcbiAgICAgIC8vIDBcbiAgICAgIHJldHVybiBjaDtcblxuICAgIGNhc2UgMHg1RjogLy8gX1xuICAgIGNhc2UgMHgyNDpcbiAgICAgIC8vICRcbiAgICAgIHJldHVybiAnaWRlbnQnO1xuXG4gICAgY2FzZSAweDIwOiAvLyBTcGFjZVxuICAgIGNhc2UgMHgwOTogLy8gVGFiXG4gICAgY2FzZSAweDBBOiAvLyBOZXdsaW5lXG4gICAgY2FzZSAweDBEOiAvLyBSZXR1cm5cbiAgICBjYXNlIDB4QTA6IC8vIE5vLWJyZWFrIHNwYWNlXG4gICAgY2FzZSAweEZFRkY6IC8vIEJ5dGUgT3JkZXIgTWFya1xuICAgIGNhc2UgMHgyMDI4OiAvLyBMaW5lIFNlcGFyYXRvclxuICAgIGNhc2UgMHgyMDI5OlxuICAgICAgLy8gUGFyYWdyYXBoIFNlcGFyYXRvclxuICAgICAgcmV0dXJuICd3cyc7XG4gIH1cblxuICAvLyBhLXosIEEtWlxuICBpZiAoY29kZSA+PSAweDYxICYmIGNvZGUgPD0gMHg3QSB8fCBjb2RlID49IDB4NDEgJiYgY29kZSA8PSAweDVBKSB7XG4gICAgcmV0dXJuICdpZGVudCc7XG4gIH1cblxuICAvLyAxLTlcbiAgaWYgKGNvZGUgPj0gMHgzMSAmJiBjb2RlIDw9IDB4MzkpIHtcbiAgICByZXR1cm4gJ251bWJlcic7XG4gIH1cblxuICByZXR1cm4gJ2Vsc2UnO1xufVxuXG4vKipcbiAqIEZvcm1hdCBhIHN1YlBhdGgsIHJldHVybiBpdHMgcGxhaW4gZm9ybSBpZiBpdCBpc1xuICogYSBsaXRlcmFsIHN0cmluZyBvciBudW1iZXIuIE90aGVyd2lzZSBwcmVwZW5kIHRoZVxuICogZHluYW1pYyBpbmRpY2F0b3IgKCopLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cblxuZnVuY3Rpb24gZm9ybWF0U3ViUGF0aChwYXRoKSB7XG4gIHZhciB0cmltbWVkID0gcGF0aC50cmltKCk7XG4gIC8vIGludmFsaWQgbGVhZGluZyAwXG4gIGlmIChwYXRoLmNoYXJBdCgwKSA9PT0gJzAnICYmIGlzTmFOKHBhdGgpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiBpc0xpdGVyYWwodHJpbW1lZCkgPyBzdHJpcFF1b3Rlcyh0cmltbWVkKSA6ICcqJyArIHRyaW1tZWQ7XG59XG5cbi8qKlxuICogUGFyc2UgYSBzdHJpbmcgcGF0aCBpbnRvIGFuIGFycmF5IG9mIHNlZ21lbnRzXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGhcbiAqIEByZXR1cm4ge0FycmF5fHVuZGVmaW5lZH1cbiAqL1xuXG5mdW5jdGlvbiBwYXJzZShwYXRoKSB7XG4gIHZhciBrZXlzID0gW107XG4gIHZhciBpbmRleCA9IC0xO1xuICB2YXIgbW9kZSA9IEJFRk9SRV9QQVRIO1xuICB2YXIgc3ViUGF0aERlcHRoID0gMDtcbiAgdmFyIGMsIG5ld0NoYXIsIGtleSwgdHlwZSwgdHJhbnNpdGlvbiwgYWN0aW9uLCB0eXBlTWFwO1xuXG4gIHZhciBhY3Rpb25zID0gW107XG5cbiAgYWN0aW9uc1tQVVNIXSA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoa2V5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGtleXMucHVzaChrZXkpO1xuICAgICAga2V5ID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgfTtcblxuICBhY3Rpb25zW0FQUEVORF0gPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKGtleSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBrZXkgPSBuZXdDaGFyO1xuICAgIH0gZWxzZSB7XG4gICAgICBrZXkgKz0gbmV3Q2hhcjtcbiAgICB9XG4gIH07XG5cbiAgYWN0aW9uc1tJTkNfU1VCX1BBVEhfREVQVEhdID0gZnVuY3Rpb24gKCkge1xuICAgIGFjdGlvbnNbQVBQRU5EXSgpO1xuICAgIHN1YlBhdGhEZXB0aCsrO1xuICB9O1xuXG4gIGFjdGlvbnNbUFVTSF9TVUJfUEFUSF0gPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHN1YlBhdGhEZXB0aCA+IDApIHtcbiAgICAgIHN1YlBhdGhEZXB0aC0tO1xuICAgICAgbW9kZSA9IElOX1NVQl9QQVRIO1xuICAgICAgYWN0aW9uc1tBUFBFTkRdKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN1YlBhdGhEZXB0aCA9IDA7XG4gICAgICBrZXkgPSBmb3JtYXRTdWJQYXRoKGtleSk7XG4gICAgICBpZiAoa2V5ID09PSBmYWxzZSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhY3Rpb25zW1BVU0hdKCk7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIGZ1bmN0aW9uIG1heWJlVW5lc2NhcGVRdW90ZSgpIHtcbiAgICB2YXIgbmV4dENoYXIgPSBwYXRoW2luZGV4ICsgMV07XG4gICAgaWYgKG1vZGUgPT09IElOX1NJTkdMRV9RVU9URSAmJiBuZXh0Q2hhciA9PT0gXCInXCIgfHwgbW9kZSA9PT0gSU5fRE9VQkxFX1FVT1RFICYmIG5leHRDaGFyID09PSAnXCInKSB7XG4gICAgICBpbmRleCsrO1xuICAgICAgbmV3Q2hhciA9ICdcXFxcJyArIG5leHRDaGFyO1xuICAgICAgYWN0aW9uc1tBUFBFTkRdKCk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICB3aGlsZSAobW9kZSAhPSBudWxsKSB7XG4gICAgaW5kZXgrKztcbiAgICBjID0gcGF0aFtpbmRleF07XG5cbiAgICBpZiAoYyA9PT0gJ1xcXFwnICYmIG1heWJlVW5lc2NhcGVRdW90ZSgpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICB0eXBlID0gZ2V0UGF0aENoYXJUeXBlKGMpO1xuICAgIHR5cGVNYXAgPSBwYXRoU3RhdGVNYWNoaW5lW21vZGVdO1xuICAgIHRyYW5zaXRpb24gPSB0eXBlTWFwW3R5cGVdIHx8IHR5cGVNYXBbJ2Vsc2UnXSB8fCBFUlJPUjtcblxuICAgIGlmICh0cmFuc2l0aW9uID09PSBFUlJPUikge1xuICAgICAgcmV0dXJuOyAvLyBwYXJzZSBlcnJvclxuICAgIH1cblxuICAgIG1vZGUgPSB0cmFuc2l0aW9uWzBdO1xuICAgIGFjdGlvbiA9IGFjdGlvbnNbdHJhbnNpdGlvblsxXV07XG4gICAgaWYgKGFjdGlvbikge1xuICAgICAgbmV3Q2hhciA9IHRyYW5zaXRpb25bMl07XG4gICAgICBuZXdDaGFyID0gbmV3Q2hhciA9PT0gdW5kZWZpbmVkID8gYyA6IG5ld0NoYXI7XG4gICAgICBpZiAoYWN0aW9uKCkgPT09IGZhbHNlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAobW9kZSA9PT0gQUZURVJfUEFUSCkge1xuICAgICAga2V5cy5yYXcgPSBwYXRoO1xuICAgICAgcmV0dXJuIGtleXM7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogRXh0ZXJuYWwgcGFyc2UgdGhhdCBjaGVjayBmb3IgYSBjYWNoZSBoaXQgZmlyc3RcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aFxuICogQHJldHVybiB7QXJyYXl8dW5kZWZpbmVkfVxuICovXG5cbmZ1bmN0aW9uIHBhcnNlUGF0aChwYXRoKSB7XG4gIHZhciBoaXQgPSBwYXRoQ2FjaGUuZ2V0KHBhdGgpO1xuICBpZiAoIWhpdCkge1xuICAgIGhpdCA9IHBhcnNlKHBhdGgpO1xuICAgIGlmIChoaXQpIHtcbiAgICAgIHBhdGhDYWNoZS5wdXQocGF0aCwgaGl0KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGhpdDtcbn1cblxuLyoqXG4gKiBHZXQgZnJvbSBhbiBvYmplY3QgZnJvbSBhIHBhdGggc3RyaW5nXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9ialxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGhcbiAqL1xuXG5mdW5jdGlvbiBnZXRQYXRoKG9iaiwgcGF0aCkge1xuICByZXR1cm4gcGFyc2VFeHByZXNzaW9uKHBhdGgpLmdldChvYmopO1xufVxuXG4vKipcbiAqIFdhcm4gYWdhaW5zdCBzZXR0aW5nIG5vbi1leGlzdGVudCByb290IHBhdGggb24gYSB2bS5cbiAqL1xuXG52YXIgd2Fybk5vbkV4aXN0ZW50O1xuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgd2Fybk5vbkV4aXN0ZW50ID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgICB3YXJuKCdZb3UgYXJlIHNldHRpbmcgYSBub24tZXhpc3RlbnQgcGF0aCBcIicgKyBwYXRoLnJhdyArICdcIiAnICsgJ29uIGEgdm0gaW5zdGFuY2UuIENvbnNpZGVyIHByZS1pbml0aWFsaXppbmcgdGhlIHByb3BlcnR5ICcgKyAnd2l0aCB0aGUgXCJkYXRhXCIgb3B0aW9uIGZvciBtb3JlIHJlbGlhYmxlIHJlYWN0aXZpdHkgJyArICdhbmQgYmV0dGVyIHBlcmZvcm1hbmNlLicpO1xuICB9O1xufVxuXG4vKipcbiAqIFNldCBvbiBhbiBvYmplY3QgZnJvbSBhIHBhdGhcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqXG4gKiBAcGFyYW0ge1N0cmluZyB8IEFycmF5fSBwYXRoXG4gKiBAcGFyYW0geyp9IHZhbFxuICovXG5cbmZ1bmN0aW9uIHNldFBhdGgob2JqLCBwYXRoLCB2YWwpIHtcbiAgdmFyIG9yaWdpbmFsID0gb2JqO1xuICBpZiAodHlwZW9mIHBhdGggPT09ICdzdHJpbmcnKSB7XG4gICAgcGF0aCA9IHBhcnNlKHBhdGgpO1xuICB9XG4gIGlmICghcGF0aCB8fCAhaXNPYmplY3Qob2JqKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICB2YXIgbGFzdCwga2V5O1xuICBmb3IgKHZhciBpID0gMCwgbCA9IHBhdGgubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgbGFzdCA9IG9iajtcbiAgICBrZXkgPSBwYXRoW2ldO1xuICAgIGlmIChrZXkuY2hhckF0KDApID09PSAnKicpIHtcbiAgICAgIGtleSA9IHBhcnNlRXhwcmVzc2lvbihrZXkuc2xpY2UoMSkpLmdldC5jYWxsKG9yaWdpbmFsLCBvcmlnaW5hbCk7XG4gICAgfVxuICAgIGlmIChpIDwgbCAtIDEpIHtcbiAgICAgIG9iaiA9IG9ialtrZXldO1xuICAgICAgaWYgKCFpc09iamVjdChvYmopKSB7XG4gICAgICAgIG9iaiA9IHt9O1xuICAgICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBsYXN0Ll9pc1Z1ZSkge1xuICAgICAgICAgIHdhcm5Ob25FeGlzdGVudChwYXRoKTtcbiAgICAgICAgfVxuICAgICAgICBzZXQobGFzdCwga2V5LCBvYmopO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoaXNBcnJheShvYmopKSB7XG4gICAgICAgIG9iai4kc2V0KGtleSwgdmFsKTtcbiAgICAgIH0gZWxzZSBpZiAoa2V5IGluIG9iaikge1xuICAgICAgICBvYmpba2V5XSA9IHZhbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIG9iai5faXNWdWUpIHtcbiAgICAgICAgICB3YXJuTm9uRXhpc3RlbnQocGF0aCk7XG4gICAgICAgIH1cbiAgICAgICAgc2V0KG9iaiwga2V5LCB2YWwpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cblxudmFyIHBhdGggPSBPYmplY3QuZnJlZXplKHtcbiAgcGFyc2VQYXRoOiBwYXJzZVBhdGgsXG4gIGdldFBhdGg6IGdldFBhdGgsXG4gIHNldFBhdGg6IHNldFBhdGhcbn0pO1xuXG52YXIgZXhwcmVzc2lvbkNhY2hlID0gbmV3IENhY2hlKDEwMDApO1xuXG52YXIgYWxsb3dlZEtleXdvcmRzID0gJ01hdGgsRGF0ZSx0aGlzLHRydWUsZmFsc2UsbnVsbCx1bmRlZmluZWQsSW5maW5pdHksTmFOLCcgKyAnaXNOYU4saXNGaW5pdGUsZGVjb2RlVVJJLGRlY29kZVVSSUNvbXBvbmVudCxlbmNvZGVVUkksJyArICdlbmNvZGVVUklDb21wb25lbnQscGFyc2VJbnQscGFyc2VGbG9hdCc7XG52YXIgYWxsb3dlZEtleXdvcmRzUkUgPSBuZXcgUmVnRXhwKCdeKCcgKyBhbGxvd2VkS2V5d29yZHMucmVwbGFjZSgvLC9nLCAnXFxcXGJ8JykgKyAnXFxcXGIpJyk7XG5cbi8vIGtleXdvcmRzIHRoYXQgZG9uJ3QgbWFrZSBzZW5zZSBpbnNpZGUgZXhwcmVzc2lvbnNcbnZhciBpbXByb3BlcktleXdvcmRzID0gJ2JyZWFrLGNhc2UsY2xhc3MsY2F0Y2gsY29uc3QsY29udGludWUsZGVidWdnZXIsZGVmYXVsdCwnICsgJ2RlbGV0ZSxkbyxlbHNlLGV4cG9ydCxleHRlbmRzLGZpbmFsbHksZm9yLGZ1bmN0aW9uLGlmLCcgKyAnaW1wb3J0LGluLGluc3RhbmNlb2YsbGV0LHJldHVybixzdXBlcixzd2l0Y2gsdGhyb3csdHJ5LCcgKyAndmFyLHdoaWxlLHdpdGgseWllbGQsZW51bSxhd2FpdCxpbXBsZW1lbnRzLHBhY2thZ2UsJyArICdwcm9jdGVjdGVkLHN0YXRpYyxpbnRlcmZhY2UscHJpdmF0ZSxwdWJsaWMnO1xudmFyIGltcHJvcGVyS2V5d29yZHNSRSA9IG5ldyBSZWdFeHAoJ14oJyArIGltcHJvcGVyS2V5d29yZHMucmVwbGFjZSgvLC9nLCAnXFxcXGJ8JykgKyAnXFxcXGIpJyk7XG5cbnZhciB3c1JFID0gL1xccy9nO1xudmFyIG5ld2xpbmVSRSA9IC9cXG4vZztcbnZhciBzYXZlUkUgPSAvW1xceyxdXFxzKltcXHdcXCRfXStcXHMqOnwoJyg/OlteJ1xcXFxdfFxcXFwuKSonfFwiKD86W15cIlxcXFxdfFxcXFwuKSpcIil8bmV3IHx0eXBlb2YgfHZvaWQgL2c7XG52YXIgcmVzdG9yZVJFID0gL1wiKFxcZCspXCIvZztcbnZhciBwYXRoVGVzdFJFID0gL15bQS1aYS16XyRdW1xcdyRdKig/OlxcLltBLVphLXpfJF1bXFx3JF0qfFxcWycuKj8nXFxdfFxcW1wiLio/XCJcXF18XFxbXFxkK1xcXXxcXFtbQS1aYS16XyRdW1xcdyRdKlxcXSkqJC87XG52YXIgaWRlbnRSRSA9IC9bXlxcdyRcXC5dKD86W0EtWmEtel8kXVtcXHckXSopL2c7XG52YXIgYm9vbGVhbkxpdGVyYWxSRSA9IC9eKD86dHJ1ZXxmYWxzZSkkLztcblxuLyoqXG4gKiBTYXZlIC8gUmV3cml0ZSAvIFJlc3RvcmVcbiAqXG4gKiBXaGVuIHJld3JpdGluZyBwYXRocyBmb3VuZCBpbiBhbiBleHByZXNzaW9uLCBpdCBpc1xuICogcG9zc2libGUgZm9yIHRoZSBzYW1lIGxldHRlciBzZXF1ZW5jZXMgdG8gYmUgZm91bmQgaW5cbiAqIHN0cmluZ3MgYW5kIE9iamVjdCBsaXRlcmFsIHByb3BlcnR5IGtleXMuIFRoZXJlZm9yZSB3ZVxuICogcmVtb3ZlIGFuZCBzdG9yZSB0aGVzZSBwYXJ0cyBpbiBhIHRlbXBvcmFyeSBhcnJheSwgYW5kXG4gKiByZXN0b3JlIHRoZW0gYWZ0ZXIgdGhlIHBhdGggcmV3cml0ZS5cbiAqL1xuXG52YXIgc2F2ZWQgPSBbXTtcblxuLyoqXG4gKiBTYXZlIHJlcGxhY2VyXG4gKlxuICogVGhlIHNhdmUgcmVnZXggY2FuIG1hdGNoIHR3byBwb3NzaWJsZSBjYXNlczpcbiAqIDEuIEFuIG9wZW5pbmcgb2JqZWN0IGxpdGVyYWxcbiAqIDIuIEEgc3RyaW5nXG4gKiBJZiBtYXRjaGVkIGFzIGEgcGxhaW4gc3RyaW5nLCB3ZSBuZWVkIHRvIGVzY2FwZSBpdHNcbiAqIG5ld2xpbmVzLCBzaW5jZSB0aGUgc3RyaW5nIG5lZWRzIHRvIGJlIHByZXNlcnZlZCB3aGVuXG4gKiBnZW5lcmF0aW5nIHRoZSBmdW5jdGlvbiBib2R5LlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBpc1N0cmluZyAtIHN0ciBpZiBtYXRjaGVkIGFzIGEgc3RyaW5nXG4gKiBAcmV0dXJuIHtTdHJpbmd9IC0gcGxhY2Vob2xkZXIgd2l0aCBpbmRleFxuICovXG5cbmZ1bmN0aW9uIHNhdmUoc3RyLCBpc1N0cmluZykge1xuICB2YXIgaSA9IHNhdmVkLmxlbmd0aDtcbiAgc2F2ZWRbaV0gPSBpc1N0cmluZyA/IHN0ci5yZXBsYWNlKG5ld2xpbmVSRSwgJ1xcXFxuJykgOiBzdHI7XG4gIHJldHVybiAnXCInICsgaSArICdcIic7XG59XG5cbi8qKlxuICogUGF0aCByZXdyaXRlIHJlcGxhY2VyXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHJhd1xuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5cbmZ1bmN0aW9uIHJld3JpdGUocmF3KSB7XG4gIHZhciBjID0gcmF3LmNoYXJBdCgwKTtcbiAgdmFyIHBhdGggPSByYXcuc2xpY2UoMSk7XG4gIGlmIChhbGxvd2VkS2V5d29yZHNSRS50ZXN0KHBhdGgpKSB7XG4gICAgcmV0dXJuIHJhdztcbiAgfSBlbHNlIHtcbiAgICBwYXRoID0gcGF0aC5pbmRleE9mKCdcIicpID4gLTEgPyBwYXRoLnJlcGxhY2UocmVzdG9yZVJFLCByZXN0b3JlKSA6IHBhdGg7XG4gICAgcmV0dXJuIGMgKyAnc2NvcGUuJyArIHBhdGg7XG4gIH1cbn1cblxuLyoqXG4gKiBSZXN0b3JlIHJlcGxhY2VyXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHBhcmFtIHtTdHJpbmd9IGkgLSBtYXRjaGVkIHNhdmUgaW5kZXhcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqL1xuXG5mdW5jdGlvbiByZXN0b3JlKHN0ciwgaSkge1xuICByZXR1cm4gc2F2ZWRbaV07XG59XG5cbi8qKlxuICogUmV3cml0ZSBhbiBleHByZXNzaW9uLCBwcmVmaXhpbmcgYWxsIHBhdGggYWNjZXNzb3JzIHdpdGhcbiAqIGBzY29wZS5gIGFuZCBnZW5lcmF0ZSBnZXR0ZXIvc2V0dGVyIGZ1bmN0aW9ucy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZXhwXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqL1xuXG5mdW5jdGlvbiBjb21waWxlR2V0dGVyKGV4cCkge1xuICBpZiAoaW1wcm9wZXJLZXl3b3Jkc1JFLnRlc3QoZXhwKSkge1xuICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgd2FybignQXZvaWQgdXNpbmcgcmVzZXJ2ZWQga2V5d29yZHMgaW4gZXhwcmVzc2lvbjogJyArIGV4cCk7XG4gIH1cbiAgLy8gcmVzZXQgc3RhdGVcbiAgc2F2ZWQubGVuZ3RoID0gMDtcbiAgLy8gc2F2ZSBzdHJpbmdzIGFuZCBvYmplY3QgbGl0ZXJhbCBrZXlzXG4gIHZhciBib2R5ID0gZXhwLnJlcGxhY2Uoc2F2ZVJFLCBzYXZlKS5yZXBsYWNlKHdzUkUsICcnKTtcbiAgLy8gcmV3cml0ZSBhbGwgcGF0aHNcbiAgLy8gcGFkIDEgc3BhY2UgaGVyZSBiZWNhdWUgdGhlIHJlZ2V4IG1hdGNoZXMgMSBleHRyYSBjaGFyXG4gIGJvZHkgPSAoJyAnICsgYm9keSkucmVwbGFjZShpZGVudFJFLCByZXdyaXRlKS5yZXBsYWNlKHJlc3RvcmVSRSwgcmVzdG9yZSk7XG4gIHJldHVybiBtYWtlR2V0dGVyRm4oYm9keSk7XG59XG5cbi8qKlxuICogQnVpbGQgYSBnZXR0ZXIgZnVuY3Rpb24uIFJlcXVpcmVzIGV2YWwuXG4gKlxuICogV2UgaXNvbGF0ZSB0aGUgdHJ5L2NhdGNoIHNvIGl0IGRvZXNuJ3QgYWZmZWN0IHRoZVxuICogb3B0aW1pemF0aW9uIG9mIHRoZSBwYXJzZSBmdW5jdGlvbiB3aGVuIGl0IGlzIG5vdCBjYWxsZWQuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGJvZHlcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufHVuZGVmaW5lZH1cbiAqL1xuXG5mdW5jdGlvbiBtYWtlR2V0dGVyRm4oYm9keSkge1xuICB0cnkge1xuICAgIHJldHVybiBuZXcgRnVuY3Rpb24oJ3Njb3BlJywgJ3JldHVybiAnICsgYm9keSArICc7Jyk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHdhcm4oJ0ludmFsaWQgZXhwcmVzc2lvbi4gJyArICdHZW5lcmF0ZWQgZnVuY3Rpb24gYm9keTogJyArIGJvZHkpO1xuICB9XG59XG5cbi8qKlxuICogQ29tcGlsZSBhIHNldHRlciBmdW5jdGlvbiBmb3IgdGhlIGV4cHJlc3Npb24uXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGV4cFxuICogQHJldHVybiB7RnVuY3Rpb258dW5kZWZpbmVkfVxuICovXG5cbmZ1bmN0aW9uIGNvbXBpbGVTZXR0ZXIoZXhwKSB7XG4gIHZhciBwYXRoID0gcGFyc2VQYXRoKGV4cCk7XG4gIGlmIChwYXRoKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIChzY29wZSwgdmFsKSB7XG4gICAgICBzZXRQYXRoKHNjb3BlLCBwYXRoLCB2YWwpO1xuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB3YXJuKCdJbnZhbGlkIHNldHRlciBleHByZXNzaW9uOiAnICsgZXhwKTtcbiAgfVxufVxuXG4vKipcbiAqIFBhcnNlIGFuIGV4cHJlc3Npb24gaW50byByZS13cml0dGVuIGdldHRlci9zZXR0ZXJzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBleHBcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gbmVlZFNldFxuICogQHJldHVybiB7RnVuY3Rpb259XG4gKi9cblxuZnVuY3Rpb24gcGFyc2VFeHByZXNzaW9uKGV4cCwgbmVlZFNldCkge1xuICBleHAgPSBleHAudHJpbSgpO1xuICAvLyB0cnkgY2FjaGVcbiAgdmFyIGhpdCA9IGV4cHJlc3Npb25DYWNoZS5nZXQoZXhwKTtcbiAgaWYgKGhpdCkge1xuICAgIGlmIChuZWVkU2V0ICYmICFoaXQuc2V0KSB7XG4gICAgICBoaXQuc2V0ID0gY29tcGlsZVNldHRlcihoaXQuZXhwKTtcbiAgICB9XG4gICAgcmV0dXJuIGhpdDtcbiAgfVxuICB2YXIgcmVzID0geyBleHA6IGV4cCB9O1xuICByZXMuZ2V0ID0gaXNTaW1wbGVQYXRoKGV4cCkgJiYgZXhwLmluZGV4T2YoJ1snKSA8IDBcbiAgLy8gb3B0aW1pemVkIHN1cGVyIHNpbXBsZSBnZXR0ZXJcbiAgPyBtYWtlR2V0dGVyRm4oJ3Njb3BlLicgKyBleHApXG4gIC8vIGR5bmFtaWMgZ2V0dGVyXG4gIDogY29tcGlsZUdldHRlcihleHApO1xuICBpZiAobmVlZFNldCkge1xuICAgIHJlcy5zZXQgPSBjb21waWxlU2V0dGVyKGV4cCk7XG4gIH1cbiAgZXhwcmVzc2lvbkNhY2hlLnB1dChleHAsIHJlcyk7XG4gIHJldHVybiByZXM7XG59XG5cbi8qKlxuICogQ2hlY2sgaWYgYW4gZXhwcmVzc2lvbiBpcyBhIHNpbXBsZSBwYXRoLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBleHBcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cblxuZnVuY3Rpb24gaXNTaW1wbGVQYXRoKGV4cCkge1xuICByZXR1cm4gcGF0aFRlc3RSRS50ZXN0KGV4cCkgJiZcbiAgLy8gZG9uJ3QgdHJlYXQgdHJ1ZS9mYWxzZSBhcyBwYXRoc1xuICAhYm9vbGVhbkxpdGVyYWxSRS50ZXN0KGV4cCkgJiZcbiAgLy8gTWF0aCBjb25zdGFudHMgZS5nLiBNYXRoLlBJLCBNYXRoLkUgZXRjLlxuICBleHAuc2xpY2UoMCwgNSkgIT09ICdNYXRoLic7XG59XG5cbnZhciBleHByZXNzaW9uID0gT2JqZWN0LmZyZWV6ZSh7XG4gIHBhcnNlRXhwcmVzc2lvbjogcGFyc2VFeHByZXNzaW9uLFxuICBpc1NpbXBsZVBhdGg6IGlzU2ltcGxlUGF0aFxufSk7XG5cbi8vIHdlIGhhdmUgdHdvIHNlcGFyYXRlIHF1ZXVlczogb25lIGZvciBkaXJlY3RpdmUgdXBkYXRlc1xuLy8gYW5kIG9uZSBmb3IgdXNlciB3YXRjaGVyIHJlZ2lzdGVyZWQgdmlhICR3YXRjaCgpLlxuLy8gd2Ugd2FudCB0byBndWFyYW50ZWUgZGlyZWN0aXZlIHVwZGF0ZXMgdG8gYmUgY2FsbGVkXG4vLyBiZWZvcmUgdXNlciB3YXRjaGVycyBzbyB0aGF0IHdoZW4gdXNlciB3YXRjaGVycyBhcmVcbi8vIHRyaWdnZXJlZCwgdGhlIERPTSB3b3VsZCBoYXZlIGFscmVhZHkgYmVlbiBpbiB1cGRhdGVkXG4vLyBzdGF0ZS5cbnZhciBxdWV1ZSA9IFtdO1xudmFyIHVzZXJRdWV1ZSA9IFtdO1xudmFyIGhhcyA9IHt9O1xudmFyIGNpcmN1bGFyID0ge307XG52YXIgd2FpdGluZyA9IGZhbHNlO1xudmFyIGludGVybmFsUXVldWVEZXBsZXRlZCA9IGZhbHNlO1xuXG4vKipcbiAqIFJlc2V0IHRoZSBiYXRjaGVyJ3Mgc3RhdGUuXG4gKi9cblxuZnVuY3Rpb24gcmVzZXRCYXRjaGVyU3RhdGUoKSB7XG4gIHF1ZXVlID0gW107XG4gIHVzZXJRdWV1ZSA9IFtdO1xuICBoYXMgPSB7fTtcbiAgY2lyY3VsYXIgPSB7fTtcbiAgd2FpdGluZyA9IGludGVybmFsUXVldWVEZXBsZXRlZCA9IGZhbHNlO1xufVxuXG4vKipcbiAqIEZsdXNoIGJvdGggcXVldWVzIGFuZCBydW4gdGhlIHdhdGNoZXJzLlxuICovXG5cbmZ1bmN0aW9uIGZsdXNoQmF0Y2hlclF1ZXVlKCkge1xuICBydW5CYXRjaGVyUXVldWUocXVldWUpO1xuICBpbnRlcm5hbFF1ZXVlRGVwbGV0ZWQgPSB0cnVlO1xuICBydW5CYXRjaGVyUXVldWUodXNlclF1ZXVlKTtcbiAgLy8gZGV2IHRvb2wgaG9va1xuICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICBpZiAoaW5Ccm93c2VyICYmIHdpbmRvdy5fX1ZVRV9ERVZUT09MU19HTE9CQUxfSE9PS19fKSB7XG4gICAgICB3aW5kb3cuX19WVUVfREVWVE9PTFNfR0xPQkFMX0hPT0tfXy5lbWl0KCdmbHVzaCcpO1xuICAgIH1cbiAgfVxuICByZXNldEJhdGNoZXJTdGF0ZSgpO1xufVxuXG4vKipcbiAqIFJ1biB0aGUgd2F0Y2hlcnMgaW4gYSBzaW5nbGUgcXVldWUuXG4gKlxuICogQHBhcmFtIHtBcnJheX0gcXVldWVcbiAqL1xuXG5mdW5jdGlvbiBydW5CYXRjaGVyUXVldWUocXVldWUpIHtcbiAgLy8gZG8gbm90IGNhY2hlIGxlbmd0aCBiZWNhdXNlIG1vcmUgd2F0Y2hlcnMgbWlnaHQgYmUgcHVzaGVkXG4gIC8vIGFzIHdlIHJ1biBleGlzdGluZyB3YXRjaGVyc1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHF1ZXVlLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIHdhdGNoZXIgPSBxdWV1ZVtpXTtcbiAgICB2YXIgaWQgPSB3YXRjaGVyLmlkO1xuICAgIGhhc1tpZF0gPSBudWxsO1xuICAgIHdhdGNoZXIucnVuKCk7XG4gICAgLy8gaW4gZGV2IGJ1aWxkLCBjaGVjayBhbmQgc3RvcCBjaXJjdWxhciB1cGRhdGVzLlxuICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIGhhc1tpZF0gIT0gbnVsbCkge1xuICAgICAgY2lyY3VsYXJbaWRdID0gKGNpcmN1bGFyW2lkXSB8fCAwKSArIDE7XG4gICAgICBpZiAoY2lyY3VsYXJbaWRdID4gY29uZmlnLl9tYXhVcGRhdGVDb3VudCkge1xuICAgICAgICBxdWV1ZS5zcGxpY2UoaGFzW2lkXSwgMSk7XG4gICAgICAgIHdhcm4oJ1lvdSBtYXkgaGF2ZSBhbiBpbmZpbml0ZSB1cGRhdGUgbG9vcCBmb3Igd2F0Y2hlciAnICsgJ3dpdGggZXhwcmVzc2lvbjogJyArIHdhdGNoZXIuZXhwcmVzc2lvbik7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogUHVzaCBhIHdhdGNoZXIgaW50byB0aGUgd2F0Y2hlciBxdWV1ZS5cbiAqIEpvYnMgd2l0aCBkdXBsaWNhdGUgSURzIHdpbGwgYmUgc2tpcHBlZCB1bmxlc3MgaXQnc1xuICogcHVzaGVkIHdoZW4gdGhlIHF1ZXVlIGlzIGJlaW5nIGZsdXNoZWQuXG4gKlxuICogQHBhcmFtIHtXYXRjaGVyfSB3YXRjaGVyXG4gKiAgIHByb3BlcnRpZXM6XG4gKiAgIC0ge051bWJlcn0gaWRcbiAqICAgLSB7RnVuY3Rpb259IHJ1blxuICovXG5cbmZ1bmN0aW9uIHB1c2hXYXRjaGVyKHdhdGNoZXIpIHtcbiAgdmFyIGlkID0gd2F0Y2hlci5pZDtcbiAgaWYgKGhhc1tpZF0gPT0gbnVsbCkge1xuICAgIC8vIGlmIGFuIGludGVybmFsIHdhdGNoZXIgaXMgcHVzaGVkLCBidXQgdGhlIGludGVybmFsXG4gICAgLy8gcXVldWUgaXMgYWxyZWFkeSBkZXBsZXRlZCwgd2UgcnVuIGl0IGltbWVkaWF0ZWx5LlxuICAgIGlmIChpbnRlcm5hbFF1ZXVlRGVwbGV0ZWQgJiYgIXdhdGNoZXIudXNlcikge1xuICAgICAgd2F0Y2hlci5ydW4oKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gcHVzaCB3YXRjaGVyIGludG8gYXBwcm9wcmlhdGUgcXVldWVcbiAgICB2YXIgcSA9IHdhdGNoZXIudXNlciA/IHVzZXJRdWV1ZSA6IHF1ZXVlO1xuICAgIGhhc1tpZF0gPSBxLmxlbmd0aDtcbiAgICBxLnB1c2god2F0Y2hlcik7XG4gICAgLy8gcXVldWUgdGhlIGZsdXNoXG4gICAgaWYgKCF3YWl0aW5nKSB7XG4gICAgICB3YWl0aW5nID0gdHJ1ZTtcbiAgICAgIG5leHRUaWNrKGZsdXNoQmF0Y2hlclF1ZXVlKTtcbiAgICB9XG4gIH1cbn1cblxudmFyIHVpZCQyID0gMDtcblxuLyoqXG4gKiBBIHdhdGNoZXIgcGFyc2VzIGFuIGV4cHJlc3Npb24sIGNvbGxlY3RzIGRlcGVuZGVuY2llcyxcbiAqIGFuZCBmaXJlcyBjYWxsYmFjayB3aGVuIHRoZSBleHByZXNzaW9uIHZhbHVlIGNoYW5nZXMuXG4gKiBUaGlzIGlzIHVzZWQgZm9yIGJvdGggdGhlICR3YXRjaCgpIGFwaSBhbmQgZGlyZWN0aXZlcy5cbiAqXG4gKiBAcGFyYW0ge1Z1ZX0gdm1cbiAqIEBwYXJhbSB7U3RyaW5nfSBleHByZXNzaW9uXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYlxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqICAgICAgICAgICAgICAgICAtIHtBcnJheX0gZmlsdGVyc1xuICogICAgICAgICAgICAgICAgIC0ge0Jvb2xlYW59IHR3b1dheVxuICogICAgICAgICAgICAgICAgIC0ge0Jvb2xlYW59IGRlZXBcbiAqICAgICAgICAgICAgICAgICAtIHtCb29sZWFufSB1c2VyXG4gKiAgICAgICAgICAgICAgICAgLSB7Qm9vbGVhbn0gc3luY1xuICogICAgICAgICAgICAgICAgIC0ge0Jvb2xlYW59IGxhenlcbiAqICAgICAgICAgICAgICAgICAtIHtGdW5jdGlvbn0gW3ByZVByb2Nlc3NdXG4gKiAgICAgICAgICAgICAgICAgLSB7RnVuY3Rpb259IFtwb3N0UHJvY2Vzc11cbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBXYXRjaGVyKHZtLCBleHBPckZuLCBjYiwgb3B0aW9ucykge1xuICAvLyBtaXggaW4gb3B0aW9uc1xuICBpZiAob3B0aW9ucykge1xuICAgIGV4dGVuZCh0aGlzLCBvcHRpb25zKTtcbiAgfVxuICB2YXIgaXNGbiA9IHR5cGVvZiBleHBPckZuID09PSAnZnVuY3Rpb24nO1xuICB0aGlzLnZtID0gdm07XG4gIHZtLl93YXRjaGVycy5wdXNoKHRoaXMpO1xuICB0aGlzLmV4cHJlc3Npb24gPSBpc0ZuID8gZXhwT3JGbi50b1N0cmluZygpIDogZXhwT3JGbjtcbiAgdGhpcy5jYiA9IGNiO1xuICB0aGlzLmlkID0gKyt1aWQkMjsgLy8gdWlkIGZvciBiYXRjaGluZ1xuICB0aGlzLmFjdGl2ZSA9IHRydWU7XG4gIHRoaXMuZGlydHkgPSB0aGlzLmxhenk7IC8vIGZvciBsYXp5IHdhdGNoZXJzXG4gIHRoaXMuZGVwcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gIHRoaXMubmV3RGVwcyA9IG51bGw7XG4gIHRoaXMucHJldkVycm9yID0gbnVsbDsgLy8gZm9yIGFzeW5jIGVycm9yIHN0YWNrc1xuICAvLyBwYXJzZSBleHByZXNzaW9uIGZvciBnZXR0ZXIvc2V0dGVyXG4gIGlmIChpc0ZuKSB7XG4gICAgdGhpcy5nZXR0ZXIgPSBleHBPckZuO1xuICAgIHRoaXMuc2V0dGVyID0gdW5kZWZpbmVkO1xuICB9IGVsc2Uge1xuICAgIHZhciByZXMgPSBwYXJzZUV4cHJlc3Npb24oZXhwT3JGbiwgdGhpcy50d29XYXkpO1xuICAgIHRoaXMuZ2V0dGVyID0gcmVzLmdldDtcbiAgICB0aGlzLnNldHRlciA9IHJlcy5zZXQ7XG4gIH1cbiAgdGhpcy52YWx1ZSA9IHRoaXMubGF6eSA/IHVuZGVmaW5lZCA6IHRoaXMuZ2V0KCk7XG4gIC8vIHN0YXRlIGZvciBhdm9pZGluZyBmYWxzZSB0cmlnZ2VycyBmb3IgZGVlcCBhbmQgQXJyYXlcbiAgLy8gd2F0Y2hlcnMgZHVyaW5nIHZtLl9kaWdlc3QoKVxuICB0aGlzLnF1ZXVlZCA9IHRoaXMuc2hhbGxvdyA9IGZhbHNlO1xufVxuXG4vKipcbiAqIEFkZCBhIGRlcGVuZGVuY3kgdG8gdGhpcyBkaXJlY3RpdmUuXG4gKlxuICogQHBhcmFtIHtEZXB9IGRlcFxuICovXG5cbldhdGNoZXIucHJvdG90eXBlLmFkZERlcCA9IGZ1bmN0aW9uIChkZXApIHtcbiAgdmFyIGlkID0gZGVwLmlkO1xuICBpZiAoIXRoaXMubmV3RGVwc1tpZF0pIHtcbiAgICB0aGlzLm5ld0RlcHNbaWRdID0gZGVwO1xuICAgIGlmICghdGhpcy5kZXBzW2lkXSkge1xuICAgICAgdGhpcy5kZXBzW2lkXSA9IGRlcDtcbiAgICAgIGRlcC5hZGRTdWIodGhpcyk7XG4gICAgfVxuICB9XG59O1xuXG4vKipcbiAqIEV2YWx1YXRlIHRoZSBnZXR0ZXIsIGFuZCByZS1jb2xsZWN0IGRlcGVuZGVuY2llcy5cbiAqL1xuXG5XYXRjaGVyLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuYmVmb3JlR2V0KCk7XG4gIHZhciBzY29wZSA9IHRoaXMuc2NvcGUgfHwgdGhpcy52bTtcbiAgdmFyIHZhbHVlO1xuICB0cnkge1xuICAgIHZhbHVlID0gdGhpcy5nZXR0ZXIuY2FsbChzY29wZSwgc2NvcGUpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgY29uZmlnLndhcm5FeHByZXNzaW9uRXJyb3JzKSB7XG4gICAgICB3YXJuKCdFcnJvciB3aGVuIGV2YWx1YXRpbmcgZXhwcmVzc2lvbiBcIicgKyB0aGlzLmV4cHJlc3Npb24gKyAnXCIuICcgKyAoY29uZmlnLmRlYnVnID8gJycgOiAnVHVybiBvbiBkZWJ1ZyBtb2RlIHRvIHNlZSBzdGFjayB0cmFjZS4nKSwgZSk7XG4gICAgfVxuICB9XG4gIC8vIFwidG91Y2hcIiBldmVyeSBwcm9wZXJ0eSBzbyB0aGV5IGFyZSBhbGwgdHJhY2tlZCBhc1xuICAvLyBkZXBlbmRlbmNpZXMgZm9yIGRlZXAgd2F0Y2hpbmdcbiAgaWYgKHRoaXMuZGVlcCkge1xuICAgIHRyYXZlcnNlKHZhbHVlKTtcbiAgfVxuICBpZiAodGhpcy5wcmVQcm9jZXNzKSB7XG4gICAgdmFsdWUgPSB0aGlzLnByZVByb2Nlc3ModmFsdWUpO1xuICB9XG4gIGlmICh0aGlzLmZpbHRlcnMpIHtcbiAgICB2YWx1ZSA9IHNjb3BlLl9hcHBseUZpbHRlcnModmFsdWUsIG51bGwsIHRoaXMuZmlsdGVycywgZmFsc2UpO1xuICB9XG4gIGlmICh0aGlzLnBvc3RQcm9jZXNzKSB7XG4gICAgdmFsdWUgPSB0aGlzLnBvc3RQcm9jZXNzKHZhbHVlKTtcbiAgfVxuICB0aGlzLmFmdGVyR2V0KCk7XG4gIHJldHVybiB2YWx1ZTtcbn07XG5cbi8qKlxuICogU2V0IHRoZSBjb3JyZXNwb25kaW5nIHZhbHVlIHdpdGggdGhlIHNldHRlci5cbiAqXG4gKiBAcGFyYW0geyp9IHZhbHVlXG4gKi9cblxuV2F0Y2hlci5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIHZhciBzY29wZSA9IHRoaXMuc2NvcGUgfHwgdGhpcy52bTtcbiAgaWYgKHRoaXMuZmlsdGVycykge1xuICAgIHZhbHVlID0gc2NvcGUuX2FwcGx5RmlsdGVycyh2YWx1ZSwgdGhpcy52YWx1ZSwgdGhpcy5maWx0ZXJzLCB0cnVlKTtcbiAgfVxuICB0cnkge1xuICAgIHRoaXMuc2V0dGVyLmNhbGwoc2NvcGUsIHNjb3BlLCB2YWx1ZSk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBjb25maWcud2FybkV4cHJlc3Npb25FcnJvcnMpIHtcbiAgICAgIHdhcm4oJ0Vycm9yIHdoZW4gZXZhbHVhdGluZyBzZXR0ZXIgXCInICsgdGhpcy5leHByZXNzaW9uICsgJ1wiJywgZSk7XG4gICAgfVxuICB9XG4gIC8vIHR3by13YXkgc3luYyBmb3Igdi1mb3IgYWxpYXNcbiAgdmFyIGZvckNvbnRleHQgPSBzY29wZS4kZm9yQ29udGV4dDtcbiAgaWYgKGZvckNvbnRleHQgJiYgZm9yQ29udGV4dC5hbGlhcyA9PT0gdGhpcy5leHByZXNzaW9uKSB7XG4gICAgaWYgKGZvckNvbnRleHQuZmlsdGVycykge1xuICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB3YXJuKCdJdCBzZWVtcyB5b3UgYXJlIHVzaW5nIHR3by13YXkgYmluZGluZyBvbiAnICsgJ2Egdi1mb3IgYWxpYXMgKCcgKyB0aGlzLmV4cHJlc3Npb24gKyAnKSwgYW5kIHRoZSAnICsgJ3YtZm9yIGhhcyBmaWx0ZXJzLiBUaGlzIHdpbGwgbm90IHdvcmsgcHJvcGVybHkuICcgKyAnRWl0aGVyIHJlbW92ZSB0aGUgZmlsdGVycyBvciB1c2UgYW4gYXJyYXkgb2YgJyArICdvYmplY3RzIGFuZCBiaW5kIHRvIG9iamVjdCBwcm9wZXJ0aWVzIGluc3RlYWQuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGZvckNvbnRleHQuX3dpdGhMb2NrKGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmIChzY29wZS4ka2V5KSB7XG4gICAgICAgIC8vIG9yaWdpbmFsIGlzIGFuIG9iamVjdFxuICAgICAgICBmb3JDb250ZXh0LnJhd1ZhbHVlW3Njb3BlLiRrZXldID0gdmFsdWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3JDb250ZXh0LnJhd1ZhbHVlLiRzZXQoc2NvcGUuJGluZGV4LCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn07XG5cbi8qKlxuICogUHJlcGFyZSBmb3IgZGVwZW5kZW5jeSBjb2xsZWN0aW9uLlxuICovXG5cbldhdGNoZXIucHJvdG90eXBlLmJlZm9yZUdldCA9IGZ1bmN0aW9uICgpIHtcbiAgRGVwLnRhcmdldCA9IHRoaXM7XG4gIHRoaXMubmV3RGVwcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG59O1xuXG4vKipcbiAqIENsZWFuIHVwIGZvciBkZXBlbmRlbmN5IGNvbGxlY3Rpb24uXG4gKi9cblxuV2F0Y2hlci5wcm90b3R5cGUuYWZ0ZXJHZXQgPSBmdW5jdGlvbiAoKSB7XG4gIERlcC50YXJnZXQgPSBudWxsO1xuICB2YXIgaWRzID0gT2JqZWN0LmtleXModGhpcy5kZXBzKTtcbiAgdmFyIGkgPSBpZHMubGVuZ3RoO1xuICB3aGlsZSAoaS0tKSB7XG4gICAgdmFyIGlkID0gaWRzW2ldO1xuICAgIGlmICghdGhpcy5uZXdEZXBzW2lkXSkge1xuICAgICAgdGhpcy5kZXBzW2lkXS5yZW1vdmVTdWIodGhpcyk7XG4gICAgfVxuICB9XG4gIHRoaXMuZGVwcyA9IHRoaXMubmV3RGVwcztcbn07XG5cbi8qKlxuICogU3Vic2NyaWJlciBpbnRlcmZhY2UuXG4gKiBXaWxsIGJlIGNhbGxlZCB3aGVuIGEgZGVwZW5kZW5jeSBjaGFuZ2VzLlxuICpcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gc2hhbGxvd1xuICovXG5cbldhdGNoZXIucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uIChzaGFsbG93KSB7XG4gIGlmICh0aGlzLmxhenkpIHtcbiAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcbiAgfSBlbHNlIGlmICh0aGlzLnN5bmMgfHwgIWNvbmZpZy5hc3luYykge1xuICAgIHRoaXMucnVuKCk7XG4gIH0gZWxzZSB7XG4gICAgLy8gaWYgcXVldWVkLCBvbmx5IG92ZXJ3cml0ZSBzaGFsbG93IHdpdGggbm9uLXNoYWxsb3csXG4gICAgLy8gYnV0IG5vdCB0aGUgb3RoZXIgd2F5IGFyb3VuZC5cbiAgICB0aGlzLnNoYWxsb3cgPSB0aGlzLnF1ZXVlZCA/IHNoYWxsb3cgPyB0aGlzLnNoYWxsb3cgOiBmYWxzZSA6ICEhc2hhbGxvdztcbiAgICB0aGlzLnF1ZXVlZCA9IHRydWU7XG4gICAgLy8gcmVjb3JkIGJlZm9yZS1wdXNoIGVycm9yIHN0YWNrIGluIGRlYnVnIG1vZGVcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBjb25maWcuZGVidWcpIHtcbiAgICAgIHRoaXMucHJldkVycm9yID0gbmV3IEVycm9yKCdbdnVlXSBhc3luYyBzdGFjayB0cmFjZScpO1xuICAgIH1cbiAgICBwdXNoV2F0Y2hlcih0aGlzKTtcbiAgfVxufTtcblxuLyoqXG4gKiBCYXRjaGVyIGpvYiBpbnRlcmZhY2UuXG4gKiBXaWxsIGJlIGNhbGxlZCBieSB0aGUgYmF0Y2hlci5cbiAqL1xuXG5XYXRjaGVyLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0aGlzLmFjdGl2ZSkge1xuICAgIHZhciB2YWx1ZSA9IHRoaXMuZ2V0KCk7XG4gICAgaWYgKHZhbHVlICE9PSB0aGlzLnZhbHVlIHx8XG4gICAgLy8gRGVlcCB3YXRjaGVycyBhbmQgd2F0Y2hlcnMgb24gT2JqZWN0L0FycmF5cyBzaG91bGQgZmlyZSBldmVuXG4gICAgLy8gd2hlbiB0aGUgdmFsdWUgaXMgdGhlIHNhbWUsIGJlY2F1c2UgdGhlIHZhbHVlIG1heVxuICAgIC8vIGhhdmUgbXV0YXRlZDsgYnV0IG9ubHkgZG8gc28gaWYgdGhpcyBpcyBhXG4gICAgLy8gbm9uLXNoYWxsb3cgdXBkYXRlIChjYXVzZWQgYnkgYSB2bSBkaWdlc3QpLlxuICAgIChpc09iamVjdCh2YWx1ZSkgfHwgdGhpcy5kZWVwKSAmJiAhdGhpcy5zaGFsbG93KSB7XG4gICAgICAvLyBzZXQgbmV3IHZhbHVlXG4gICAgICB2YXIgb2xkVmFsdWUgPSB0aGlzLnZhbHVlO1xuICAgICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICAgICAgLy8gaW4gZGVidWcgKyBhc3luYyBtb2RlLCB3aGVuIGEgd2F0Y2hlciBjYWxsYmFja3NcbiAgICAgIC8vIHRocm93cywgd2UgYWxzbyB0aHJvdyB0aGUgc2F2ZWQgYmVmb3JlLXB1c2ggZXJyb3JcbiAgICAgIC8vIHNvIHRoZSBmdWxsIGNyb3NzLXRpY2sgc3RhY2sgdHJhY2UgaXMgYXZhaWxhYmxlLlxuICAgICAgdmFyIHByZXZFcnJvciA9IHRoaXMucHJldkVycm9yO1xuICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBjb25maWcuZGVidWcgJiYgcHJldkVycm9yKSB7XG4gICAgICAgIHRoaXMucHJldkVycm9yID0gbnVsbDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB0aGlzLmNiLmNhbGwodGhpcy52bSwgdmFsdWUsIG9sZFZhbHVlKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRocm93IHByZXZFcnJvcjtcbiAgICAgICAgICB9LCAwKTtcbiAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmNiLmNhbGwodGhpcy52bSwgdmFsdWUsIG9sZFZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5xdWV1ZWQgPSB0aGlzLnNoYWxsb3cgPSBmYWxzZTtcbiAgfVxufTtcblxuLyoqXG4gKiBFdmFsdWF0ZSB0aGUgdmFsdWUgb2YgdGhlIHdhdGNoZXIuXG4gKiBUaGlzIG9ubHkgZ2V0cyBjYWxsZWQgZm9yIGxhenkgd2F0Y2hlcnMuXG4gKi9cblxuV2F0Y2hlci5wcm90b3R5cGUuZXZhbHVhdGUgPSBmdW5jdGlvbiAoKSB7XG4gIC8vIGF2b2lkIG92ZXJ3cml0aW5nIGFub3RoZXIgd2F0Y2hlciB0aGF0IGlzIGJlaW5nXG4gIC8vIGNvbGxlY3RlZC5cbiAgdmFyIGN1cnJlbnQgPSBEZXAudGFyZ2V0O1xuICB0aGlzLnZhbHVlID0gdGhpcy5nZXQoKTtcbiAgdGhpcy5kaXJ0eSA9IGZhbHNlO1xuICBEZXAudGFyZ2V0ID0gY3VycmVudDtcbn07XG5cbi8qKlxuICogRGVwZW5kIG9uIGFsbCBkZXBzIGNvbGxlY3RlZCBieSB0aGlzIHdhdGNoZXIuXG4gKi9cblxuV2F0Y2hlci5wcm90b3R5cGUuZGVwZW5kID0gZnVuY3Rpb24gKCkge1xuICB2YXIgZGVwSWRzID0gT2JqZWN0LmtleXModGhpcy5kZXBzKTtcbiAgdmFyIGkgPSBkZXBJZHMubGVuZ3RoO1xuICB3aGlsZSAoaS0tKSB7XG4gICAgdGhpcy5kZXBzW2RlcElkc1tpXV0uZGVwZW5kKCk7XG4gIH1cbn07XG5cbi8qKlxuICogUmVtb3ZlIHNlbGYgZnJvbSBhbGwgZGVwZW5kZW5jaWVzJyBzdWJjcmliZXIgbGlzdC5cbiAqL1xuXG5XYXRjaGVyLnByb3RvdHlwZS50ZWFyZG93biA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHRoaXMuYWN0aXZlKSB7XG4gICAgLy8gcmVtb3ZlIHNlbGYgZnJvbSB2bSdzIHdhdGNoZXIgbGlzdFxuICAgIC8vIHdlIGNhbiBza2lwIHRoaXMgaWYgdGhlIHZtIGlmIGJlaW5nIGRlc3Ryb3llZFxuICAgIC8vIHdoaWNoIGNhbiBpbXByb3ZlIHRlYXJkb3duIHBlcmZvcm1hbmNlLlxuICAgIGlmICghdGhpcy52bS5faXNCZWluZ0Rlc3Ryb3llZCkge1xuICAgICAgdGhpcy52bS5fd2F0Y2hlcnMuJHJlbW92ZSh0aGlzKTtcbiAgICB9XG4gICAgdmFyIGRlcElkcyA9IE9iamVjdC5rZXlzKHRoaXMuZGVwcyk7XG4gICAgdmFyIGkgPSBkZXBJZHMubGVuZ3RoO1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIHRoaXMuZGVwc1tkZXBJZHNbaV1dLnJlbW92ZVN1Yih0aGlzKTtcbiAgICB9XG4gICAgdGhpcy5hY3RpdmUgPSBmYWxzZTtcbiAgICB0aGlzLnZtID0gdGhpcy5jYiA9IHRoaXMudmFsdWUgPSBudWxsO1xuICB9XG59O1xuXG4vKipcbiAqIFJlY3J1c2l2ZWx5IHRyYXZlcnNlIGFuIG9iamVjdCB0byBldm9rZSBhbGwgY29udmVydGVkXG4gKiBnZXR0ZXJzLCBzbyB0aGF0IGV2ZXJ5IG5lc3RlZCBwcm9wZXJ0eSBpbnNpZGUgdGhlIG9iamVjdFxuICogaXMgY29sbGVjdGVkIGFzIGEgXCJkZWVwXCIgZGVwZW5kZW5jeS5cbiAqXG4gKiBAcGFyYW0geyp9IHZhbFxuICovXG5cbmZ1bmN0aW9uIHRyYXZlcnNlKHZhbCkge1xuICB2YXIgaSwga2V5cztcbiAgaWYgKGlzQXJyYXkodmFsKSkge1xuICAgIGkgPSB2YWwubGVuZ3RoO1xuICAgIHdoaWxlIChpLS0pIHRyYXZlcnNlKHZhbFtpXSk7XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QodmFsKSkge1xuICAgIGtleXMgPSBPYmplY3Qua2V5cyh2YWwpO1xuICAgIGkgPSBrZXlzLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKSB0cmF2ZXJzZSh2YWxba2V5c1tpXV0pO1xuICB9XG59XG5cbnZhciBjbG9hayA9IHtcbiAgYmluZDogZnVuY3Rpb24gYmluZCgpIHtcbiAgICB2YXIgZWwgPSB0aGlzLmVsO1xuICAgIHRoaXMudm0uJG9uY2UoJ3ByZS1ob29rOmNvbXBpbGVkJywgZnVuY3Rpb24gKCkge1xuICAgICAgZWwucmVtb3ZlQXR0cmlidXRlKCd2LWNsb2FrJyk7XG4gICAgfSk7XG4gIH1cbn07XG5cbnZhciByZWYgPSB7XG4gIGJpbmQ6IGZ1bmN0aW9uIGJpbmQoKSB7XG4gICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB3YXJuKCd2LXJlZjonICsgdGhpcy5hcmcgKyAnIG11c3QgYmUgdXNlZCBvbiBhIGNoaWxkICcgKyAnY29tcG9uZW50LiBGb3VuZCBvbiA8JyArIHRoaXMuZWwudGFnTmFtZS50b0xvd2VyQ2FzZSgpICsgJz4uJyk7XG4gIH1cbn07XG5cbnZhciBPTiA9IDcwMDtcbnZhciBNT0RFTCA9IDgwMDtcbnZhciBCSU5EID0gODUwO1xudmFyIFRSQU5TSVRJT04gPSAxMTAwO1xudmFyIEVMID0gMTUwMDtcbnZhciBDT01QT05FTlQgPSAxNTAwO1xudmFyIFBBUlRJQUwgPSAxNzUwO1xudmFyIFNMT1QgPSAxNzUwO1xudmFyIEZPUiA9IDIwMDA7XG52YXIgSUYgPSAyMDAwO1xuXG52YXIgZWwgPSB7XG5cbiAgcHJpb3JpdHk6IEVMLFxuXG4gIGJpbmQ6IGZ1bmN0aW9uIGJpbmQoKSB7XG4gICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgaWYgKCF0aGlzLmFyZykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgaWQgPSB0aGlzLmlkID0gY2FtZWxpemUodGhpcy5hcmcpO1xuICAgIHZhciByZWZzID0gKHRoaXMuX3Njb3BlIHx8IHRoaXMudm0pLiRlbHM7XG4gICAgaWYgKGhhc093bihyZWZzLCBpZCkpIHtcbiAgICAgIHJlZnNbaWRdID0gdGhpcy5lbDtcbiAgICB9IGVsc2Uge1xuICAgICAgZGVmaW5lUmVhY3RpdmUocmVmcywgaWQsIHRoaXMuZWwpO1xuICAgIH1cbiAgfSxcblxuICB1bmJpbmQ6IGZ1bmN0aW9uIHVuYmluZCgpIHtcbiAgICB2YXIgcmVmcyA9ICh0aGlzLl9zY29wZSB8fCB0aGlzLnZtKS4kZWxzO1xuICAgIGlmIChyZWZzW3RoaXMuaWRdID09PSB0aGlzLmVsKSB7XG4gICAgICByZWZzW3RoaXMuaWRdID0gbnVsbDtcbiAgICB9XG4gIH1cbn07XG5cbnZhciBwcmVmaXhlcyA9IFsnLXdlYmtpdC0nLCAnLW1vei0nLCAnLW1zLSddO1xudmFyIGNhbWVsUHJlZml4ZXMgPSBbJ1dlYmtpdCcsICdNb3onLCAnbXMnXTtcbnZhciBpbXBvcnRhbnRSRSA9IC8haW1wb3J0YW50Oz8kLztcbnZhciBwcm9wQ2FjaGUgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG52YXIgdGVzdEVsID0gbnVsbDtcblxudmFyIHN0eWxlID0ge1xuXG4gIGRlZXA6IHRydWUsXG5cbiAgdXBkYXRlOiBmdW5jdGlvbiB1cGRhdGUodmFsdWUpIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgdGhpcy5lbC5zdHlsZS5jc3NUZXh0ID0gdmFsdWU7XG4gICAgfSBlbHNlIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgICAgdGhpcy5oYW5kbGVPYmplY3QodmFsdWUucmVkdWNlKGV4dGVuZCwge30pKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5oYW5kbGVPYmplY3QodmFsdWUgfHwge30pO1xuICAgIH1cbiAgfSxcblxuICBoYW5kbGVPYmplY3Q6IGZ1bmN0aW9uIGhhbmRsZU9iamVjdCh2YWx1ZSkge1xuICAgIC8vIGNhY2hlIG9iamVjdCBzdHlsZXMgc28gdGhhdCBvbmx5IGNoYW5nZWQgcHJvcHNcbiAgICAvLyBhcmUgYWN0dWFsbHkgdXBkYXRlZC5cbiAgICB2YXIgY2FjaGUgPSB0aGlzLmNhY2hlIHx8ICh0aGlzLmNhY2hlID0ge30pO1xuICAgIHZhciBuYW1lLCB2YWw7XG4gICAgZm9yIChuYW1lIGluIGNhY2hlKSB7XG4gICAgICBpZiAoIShuYW1lIGluIHZhbHVlKSkge1xuICAgICAgICB0aGlzLmhhbmRsZVNpbmdsZShuYW1lLCBudWxsKTtcbiAgICAgICAgZGVsZXRlIGNhY2hlW25hbWVdO1xuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKG5hbWUgaW4gdmFsdWUpIHtcbiAgICAgIHZhbCA9IHZhbHVlW25hbWVdO1xuICAgICAgaWYgKHZhbCAhPT0gY2FjaGVbbmFtZV0pIHtcbiAgICAgICAgY2FjaGVbbmFtZV0gPSB2YWw7XG4gICAgICAgIHRoaXMuaGFuZGxlU2luZ2xlKG5hbWUsIHZhbCk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIGhhbmRsZVNpbmdsZTogZnVuY3Rpb24gaGFuZGxlU2luZ2xlKHByb3AsIHZhbHVlKSB7XG4gICAgcHJvcCA9IG5vcm1hbGl6ZShwcm9wKTtcbiAgICBpZiAoIXByb3ApIHJldHVybjsgLy8gdW5zdXBwb3J0ZWQgcHJvcFxuICAgIC8vIGNhc3QgcG9zc2libGUgbnVtYmVycy9ib29sZWFucyBpbnRvIHN0cmluZ3NcbiAgICBpZiAodmFsdWUgIT0gbnVsbCkgdmFsdWUgKz0gJyc7XG4gICAgaWYgKHZhbHVlKSB7XG4gICAgICB2YXIgaXNJbXBvcnRhbnQgPSBpbXBvcnRhbnRSRS50ZXN0KHZhbHVlKSA/ICdpbXBvcnRhbnQnIDogJyc7XG4gICAgICBpZiAoaXNJbXBvcnRhbnQpIHtcbiAgICAgICAgdmFsdWUgPSB2YWx1ZS5yZXBsYWNlKGltcG9ydGFudFJFLCAnJykudHJpbSgpO1xuICAgICAgfVxuICAgICAgdGhpcy5lbC5zdHlsZS5zZXRQcm9wZXJ0eShwcm9wLCB2YWx1ZSwgaXNJbXBvcnRhbnQpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmVsLnN0eWxlLnJlbW92ZVByb3BlcnR5KHByb3ApO1xuICAgIH1cbiAgfVxuXG59O1xuXG4vKipcbiAqIE5vcm1hbGl6ZSBhIENTUyBwcm9wZXJ0eSBuYW1lLlxuICogLSBjYWNoZSByZXN1bHRcbiAqIC0gYXV0byBwcmVmaXhcbiAqIC0gY2FtZWxDYXNlIC0+IGRhc2gtY2FzZVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwcm9wXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cblxuZnVuY3Rpb24gbm9ybWFsaXplKHByb3ApIHtcbiAgaWYgKHByb3BDYWNoZVtwcm9wXSkge1xuICAgIHJldHVybiBwcm9wQ2FjaGVbcHJvcF07XG4gIH1cbiAgdmFyIHJlcyA9IHByZWZpeChwcm9wKTtcbiAgcHJvcENhY2hlW3Byb3BdID0gcHJvcENhY2hlW3Jlc10gPSByZXM7XG4gIHJldHVybiByZXM7XG59XG5cbi8qKlxuICogQXV0byBkZXRlY3QgdGhlIGFwcHJvcHJpYXRlIHByZWZpeCBmb3IgYSBDU1MgcHJvcGVydHkuXG4gKiBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9wYXVsaXJpc2gvNTIzNjkyXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHByb3BcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqL1xuXG5mdW5jdGlvbiBwcmVmaXgocHJvcCkge1xuICBwcm9wID0gaHlwaGVuYXRlKHByb3ApO1xuICB2YXIgY2FtZWwgPSBjYW1lbGl6ZShwcm9wKTtcbiAgdmFyIHVwcGVyID0gY2FtZWwuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBjYW1lbC5zbGljZSgxKTtcbiAgaWYgKCF0ZXN0RWwpIHtcbiAgICB0ZXN0RWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgfVxuICBpZiAoY2FtZWwgaW4gdGVzdEVsLnN0eWxlKSB7XG4gICAgcmV0dXJuIHByb3A7XG4gIH1cbiAgdmFyIGkgPSBwcmVmaXhlcy5sZW5ndGg7XG4gIHZhciBwcmVmaXhlZDtcbiAgd2hpbGUgKGktLSkge1xuICAgIHByZWZpeGVkID0gY2FtZWxQcmVmaXhlc1tpXSArIHVwcGVyO1xuICAgIGlmIChwcmVmaXhlZCBpbiB0ZXN0RWwuc3R5bGUpIHtcbiAgICAgIHJldHVybiBwcmVmaXhlc1tpXSArIHByb3A7XG4gICAgfVxuICB9XG59XG5cbi8vIHhsaW5rXG52YXIgeGxpbmtOUyA9ICdodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rJztcbnZhciB4bGlua1JFID0gL154bGluazovO1xuXG4vLyBjaGVjayBmb3IgYXR0cmlidXRlcyB0aGF0IHByb2hpYml0IGludGVycG9sYXRpb25zXG52YXIgZGlzYWxsb3dlZEludGVycEF0dHJSRSA9IC9edi18Xjp8XkB8Xihpc3x0cmFuc2l0aW9ufHRyYW5zaXRpb24tbW9kZXxkZWJvdW5jZXx0cmFjay1ieXxzdGFnZ2VyfGVudGVyLXN0YWdnZXJ8bGVhdmUtc3RhZ2dlcikkLztcblxuLy8gdGhlc2UgYXR0cmlidXRlcyBzaG91bGQgYWxzbyBzZXQgdGhlaXIgY29ycmVzcG9uZGluZyBwcm9wZXJ0aWVzXG4vLyBiZWNhdXNlIHRoZXkgb25seSBhZmZlY3QgdGhlIGluaXRpYWwgc3RhdGUgb2YgdGhlIGVsZW1lbnRcbnZhciBhdHRyV2l0aFByb3BzUkUgPSAvXih2YWx1ZXxjaGVja2VkfHNlbGVjdGVkfG11dGVkKSQvO1xuXG4vLyB0aGVzZSBhdHRyaWJ1dGVzIHNob3VsZCBzZXQgYSBoaWRkZW4gcHJvcGVydHkgZm9yXG4vLyBiaW5kaW5nIHYtbW9kZWwgdG8gb2JqZWN0IHZhbHVlc1xudmFyIG1vZGVsUHJvcHMgPSB7XG4gIHZhbHVlOiAnX3ZhbHVlJyxcbiAgJ3RydWUtdmFsdWUnOiAnX3RydWVWYWx1ZScsXG4gICdmYWxzZS12YWx1ZSc6ICdfZmFsc2VWYWx1ZSdcbn07XG5cbnZhciBiaW5kID0ge1xuXG4gIHByaW9yaXR5OiBCSU5ELFxuXG4gIGJpbmQ6IGZ1bmN0aW9uIGJpbmQoKSB7XG4gICAgdmFyIGF0dHIgPSB0aGlzLmFyZztcbiAgICB2YXIgdGFnID0gdGhpcy5lbC50YWdOYW1lO1xuICAgIC8vIHNob3VsZCBiZSBkZWVwIHdhdGNoIG9uIG9iamVjdCBtb2RlXG4gICAgaWYgKCFhdHRyKSB7XG4gICAgICB0aGlzLmRlZXAgPSB0cnVlO1xuICAgIH1cbiAgICAvLyBoYW5kbGUgaW50ZXJwb2xhdGlvbiBiaW5kaW5nc1xuICAgIGlmICh0aGlzLmRlc2NyaXB0b3IuaW50ZXJwKSB7XG4gICAgICAvLyBvbmx5IGFsbG93IGJpbmRpbmcgb24gbmF0aXZlIGF0dHJpYnV0ZXNcbiAgICAgIGlmIChkaXNhbGxvd2VkSW50ZXJwQXR0clJFLnRlc3QoYXR0cikgfHwgYXR0ciA9PT0gJ25hbWUnICYmICh0YWcgPT09ICdQQVJUSUFMJyB8fCB0YWcgPT09ICdTTE9UJykpIHtcbiAgICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB3YXJuKGF0dHIgKyAnPVwiJyArIHRoaXMuZGVzY3JpcHRvci5yYXcgKyAnXCI6ICcgKyAnYXR0cmlidXRlIGludGVycG9sYXRpb24gaXMgbm90IGFsbG93ZWQgaW4gVnVlLmpzICcgKyAnZGlyZWN0aXZlcyBhbmQgc3BlY2lhbCBhdHRyaWJ1dGVzLicpO1xuICAgICAgICB0aGlzLmVsLnJlbW92ZUF0dHJpYnV0ZShhdHRyKTtcbiAgICAgICAgdGhpcy5pbnZhbGlkID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICB2YXIgcmF3ID0gYXR0ciArICc9XCInICsgdGhpcy5kZXNjcmlwdG9yLnJhdyArICdcIjogJztcbiAgICAgICAgLy8gd2FybiBzcmNcbiAgICAgICAgaWYgKGF0dHIgPT09ICdzcmMnKSB7XG4gICAgICAgICAgd2FybihyYXcgKyAnaW50ZXJwb2xhdGlvbiBpbiBcInNyY1wiIGF0dHJpYnV0ZSB3aWxsIGNhdXNlICcgKyAnYSA0MDQgcmVxdWVzdC4gVXNlIHYtYmluZDpzcmMgaW5zdGVhZC4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHdhcm4gc3R5bGVcbiAgICAgICAgaWYgKGF0dHIgPT09ICdzdHlsZScpIHtcbiAgICAgICAgICB3YXJuKHJhdyArICdpbnRlcnBvbGF0aW9uIGluIFwic3R5bGVcIiBhdHRyaWJ1dGUgd2lsbCBjYXVzZSAnICsgJ3RoZSBhdHRyaWJ1dGUgdG8gYmUgZGlzY2FyZGVkIGluIEludGVybmV0IEV4cGxvcmVyLiAnICsgJ1VzZSB2LWJpbmQ6c3R5bGUgaW5zdGVhZC4nKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICB1cGRhdGU6IGZ1bmN0aW9uIHVwZGF0ZSh2YWx1ZSkge1xuICAgIGlmICh0aGlzLmludmFsaWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIGF0dHIgPSB0aGlzLmFyZztcbiAgICBpZiAodGhpcy5hcmcpIHtcbiAgICAgIHRoaXMuaGFuZGxlU2luZ2xlKGF0dHIsIHZhbHVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5oYW5kbGVPYmplY3QodmFsdWUgfHwge30pO1xuICAgIH1cbiAgfSxcblxuICAvLyBzaGFyZSBvYmplY3QgaGFuZGxlciB3aXRoIHYtYmluZDpjbGFzc1xuICBoYW5kbGVPYmplY3Q6IHN0eWxlLmhhbmRsZU9iamVjdCxcblxuICBoYW5kbGVTaW5nbGU6IGZ1bmN0aW9uIGhhbmRsZVNpbmdsZShhdHRyLCB2YWx1ZSkge1xuICAgIHZhciBlbCA9IHRoaXMuZWw7XG4gICAgdmFyIGludGVycCA9IHRoaXMuZGVzY3JpcHRvci5pbnRlcnA7XG4gICAgaWYgKCFpbnRlcnAgJiYgYXR0cldpdGhQcm9wc1JFLnRlc3QoYXR0cikgJiYgYXR0ciBpbiBlbCkge1xuICAgICAgZWxbYXR0cl0gPSBhdHRyID09PSAndmFsdWUnID8gdmFsdWUgPT0gbnVsbCAvLyBJRTkgd2lsbCBzZXQgaW5wdXQudmFsdWUgdG8gXCJudWxsXCIgZm9yIG51bGwuLi5cbiAgICAgID8gJycgOiB2YWx1ZSA6IHZhbHVlO1xuICAgIH1cbiAgICAvLyBzZXQgbW9kZWwgcHJvcHNcbiAgICB2YXIgbW9kZWxQcm9wID0gbW9kZWxQcm9wc1thdHRyXTtcbiAgICBpZiAoIWludGVycCAmJiBtb2RlbFByb3ApIHtcbiAgICAgIGVsW21vZGVsUHJvcF0gPSB2YWx1ZTtcbiAgICAgIC8vIHVwZGF0ZSB2LW1vZGVsIGlmIHByZXNlbnRcbiAgICAgIHZhciBtb2RlbCA9IGVsLl9fdl9tb2RlbDtcbiAgICAgIGlmIChtb2RlbCkge1xuICAgICAgICBtb2RlbC5saXN0ZW5lcigpO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBkbyBub3Qgc2V0IHZhbHVlIGF0dHJpYnV0ZSBmb3IgdGV4dGFyZWFcbiAgICBpZiAoYXR0ciA9PT0gJ3ZhbHVlJyAmJiBlbC50YWdOYW1lID09PSAnVEVYVEFSRUEnKSB7XG4gICAgICBlbC5yZW1vdmVBdHRyaWJ1dGUoYXR0cik7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIHVwZGF0ZSBhdHRyaWJ1dGVcbiAgICBpZiAodmFsdWUgIT0gbnVsbCAmJiB2YWx1ZSAhPT0gZmFsc2UpIHtcbiAgICAgIGlmIChhdHRyID09PSAnY2xhc3MnKSB7XG4gICAgICAgIC8vIGhhbmRsZSBlZGdlIGNhc2UgIzE5NjA6XG4gICAgICAgIC8vIGNsYXNzIGludGVycG9sYXRpb24gc2hvdWxkIG5vdCBvdmVyd3JpdGUgVnVlIHRyYW5zaXRpb24gY2xhc3NcbiAgICAgICAgaWYgKGVsLl9fdl90cmFucykge1xuICAgICAgICAgIHZhbHVlICs9ICcgJyArIGVsLl9fdl90cmFucy5pZCArICctdHJhbnNpdGlvbic7XG4gICAgICAgIH1cbiAgICAgICAgc2V0Q2xhc3MoZWwsIHZhbHVlKTtcbiAgICAgIH0gZWxzZSBpZiAoeGxpbmtSRS50ZXN0KGF0dHIpKSB7XG4gICAgICAgIGVsLnNldEF0dHJpYnV0ZU5TKHhsaW5rTlMsIGF0dHIsIHZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVsLnNldEF0dHJpYnV0ZShhdHRyLCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGVsLnJlbW92ZUF0dHJpYnV0ZShhdHRyKTtcbiAgICB9XG4gIH1cbn07XG5cbi8vIGtleUNvZGUgYWxpYXNlc1xudmFyIGtleUNvZGVzID0ge1xuICBlc2M6IDI3LFxuICB0YWI6IDksXG4gIGVudGVyOiAxMyxcbiAgc3BhY2U6IDMyLFxuICAnZGVsZXRlJzogNDYsXG4gIHVwOiAzOCxcbiAgbGVmdDogMzcsXG4gIHJpZ2h0OiAzOSxcbiAgZG93bjogNDBcbn07XG5cbmZ1bmN0aW9uIGtleUZpbHRlcihoYW5kbGVyLCBrZXlzKSB7XG4gIHZhciBjb2RlcyA9IGtleXMubWFwKGZ1bmN0aW9uIChrZXkpIHtcbiAgICB2YXIgY2hhckNvZGUgPSBrZXkuY2hhckNvZGVBdCgwKTtcbiAgICBpZiAoY2hhckNvZGUgPiA0NyAmJiBjaGFyQ29kZSA8IDU4KSB7XG4gICAgICByZXR1cm4gcGFyc2VJbnQoa2V5LCAxMCk7XG4gICAgfVxuICAgIGlmIChrZXkubGVuZ3RoID09PSAxKSB7XG4gICAgICBjaGFyQ29kZSA9IGtleS50b1VwcGVyQ2FzZSgpLmNoYXJDb2RlQXQoMCk7XG4gICAgICBpZiAoY2hhckNvZGUgPiA2NCAmJiBjaGFyQ29kZSA8IDkxKSB7XG4gICAgICAgIHJldHVybiBjaGFyQ29kZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGtleUNvZGVzW2tleV07XG4gIH0pO1xuICByZXR1cm4gZnVuY3Rpb24ga2V5SGFuZGxlcihlKSB7XG4gICAgaWYgKGNvZGVzLmluZGV4T2YoZS5rZXlDb2RlKSA+IC0xKSB7XG4gICAgICByZXR1cm4gaGFuZGxlci5jYWxsKHRoaXMsIGUpO1xuICAgIH1cbiAgfTtcbn1cblxuZnVuY3Rpb24gc3RvcEZpbHRlcihoYW5kbGVyKSB7XG4gIHJldHVybiBmdW5jdGlvbiBzdG9wSGFuZGxlcihlKSB7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICByZXR1cm4gaGFuZGxlci5jYWxsKHRoaXMsIGUpO1xuICB9O1xufVxuXG5mdW5jdGlvbiBwcmV2ZW50RmlsdGVyKGhhbmRsZXIpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHByZXZlbnRIYW5kbGVyKGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgcmV0dXJuIGhhbmRsZXIuY2FsbCh0aGlzLCBlKTtcbiAgfTtcbn1cblxudmFyIG9uID0ge1xuXG4gIGFjY2VwdFN0YXRlbWVudDogdHJ1ZSxcbiAgcHJpb3JpdHk6IE9OLFxuXG4gIGJpbmQ6IGZ1bmN0aW9uIGJpbmQoKSB7XG4gICAgLy8gZGVhbCB3aXRoIGlmcmFtZXNcbiAgICBpZiAodGhpcy5lbC50YWdOYW1lID09PSAnSUZSQU1FJyAmJiB0aGlzLmFyZyAhPT0gJ2xvYWQnKSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICB0aGlzLmlmcmFtZUJpbmQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIG9uJDEoc2VsZi5lbC5jb250ZW50V2luZG93LCBzZWxmLmFyZywgc2VsZi5oYW5kbGVyKTtcbiAgICAgIH07XG4gICAgICB0aGlzLm9uKCdsb2FkJywgdGhpcy5pZnJhbWVCaW5kKTtcbiAgICB9XG4gIH0sXG5cbiAgdXBkYXRlOiBmdW5jdGlvbiB1cGRhdGUoaGFuZGxlcikge1xuICAgIC8vIHN0dWIgYSBub29wIGZvciB2LW9uIHdpdGggbm8gdmFsdWUsXG4gICAgLy8gZS5nLiBAbW91c2Vkb3duLnByZXZlbnRcbiAgICBpZiAoIXRoaXMuZGVzY3JpcHRvci5yYXcpIHtcbiAgICAgIGhhbmRsZXIgPSBmdW5jdGlvbiAoKSB7fTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGhhbmRsZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgd2Fybigndi1vbjonICsgdGhpcy5hcmcgKyAnPVwiJyArIHRoaXMuZXhwcmVzc2lvbiArICdcIiBleHBlY3RzIGEgZnVuY3Rpb24gdmFsdWUsICcgKyAnZ290ICcgKyBoYW5kbGVyKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBhcHBseSBtb2RpZmllcnNcbiAgICBpZiAodGhpcy5tb2RpZmllcnMuc3RvcCkge1xuICAgICAgaGFuZGxlciA9IHN0b3BGaWx0ZXIoaGFuZGxlcik7XG4gICAgfVxuICAgIGlmICh0aGlzLm1vZGlmaWVycy5wcmV2ZW50KSB7XG4gICAgICBoYW5kbGVyID0gcHJldmVudEZpbHRlcihoYW5kbGVyKTtcbiAgICB9XG4gICAgLy8ga2V5IGZpbHRlclxuICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXModGhpcy5tb2RpZmllcnMpLmZpbHRlcihmdW5jdGlvbiAoa2V5KSB7XG4gICAgICByZXR1cm4ga2V5ICE9PSAnc3RvcCcgJiYga2V5ICE9PSAncHJldmVudCc7XG4gICAgfSk7XG4gICAgaWYgKGtleXMubGVuZ3RoKSB7XG4gICAgICBoYW5kbGVyID0ga2V5RmlsdGVyKGhhbmRsZXIsIGtleXMpO1xuICAgIH1cblxuICAgIHRoaXMucmVzZXQoKTtcbiAgICB0aGlzLmhhbmRsZXIgPSBoYW5kbGVyO1xuXG4gICAgaWYgKHRoaXMuaWZyYW1lQmluZCkge1xuICAgICAgdGhpcy5pZnJhbWVCaW5kKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9uJDEodGhpcy5lbCwgdGhpcy5hcmcsIHRoaXMuaGFuZGxlcik7XG4gICAgfVxuICB9LFxuXG4gIHJlc2V0OiBmdW5jdGlvbiByZXNldCgpIHtcbiAgICB2YXIgZWwgPSB0aGlzLmlmcmFtZUJpbmQgPyB0aGlzLmVsLmNvbnRlbnRXaW5kb3cgOiB0aGlzLmVsO1xuICAgIGlmICh0aGlzLmhhbmRsZXIpIHtcbiAgICAgIG9mZihlbCwgdGhpcy5hcmcsIHRoaXMuaGFuZGxlcik7XG4gICAgfVxuICB9LFxuXG4gIHVuYmluZDogZnVuY3Rpb24gdW5iaW5kKCkge1xuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxufTtcblxudmFyIGNoZWNrYm94ID0ge1xuXG4gIGJpbmQ6IGZ1bmN0aW9uIGJpbmQoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBlbCA9IHRoaXMuZWw7XG5cbiAgICB0aGlzLmdldFZhbHVlID0gZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIGVsLmhhc093blByb3BlcnR5KCdfdmFsdWUnKSA/IGVsLl92YWx1ZSA6IHNlbGYucGFyYW1zLm51bWJlciA/IHRvTnVtYmVyKGVsLnZhbHVlKSA6IGVsLnZhbHVlO1xuICAgIH07XG5cbiAgICBmdW5jdGlvbiBnZXRCb29sZWFuVmFsdWUoKSB7XG4gICAgICB2YXIgdmFsID0gZWwuY2hlY2tlZDtcbiAgICAgIGlmICh2YWwgJiYgZWwuaGFzT3duUHJvcGVydHkoJ190cnVlVmFsdWUnKSkge1xuICAgICAgICByZXR1cm4gZWwuX3RydWVWYWx1ZTtcbiAgICAgIH1cbiAgICAgIGlmICghdmFsICYmIGVsLmhhc093blByb3BlcnR5KCdfZmFsc2VWYWx1ZScpKSB7XG4gICAgICAgIHJldHVybiBlbC5fZmFsc2VWYWx1ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB2YWw7XG4gICAgfVxuXG4gICAgdGhpcy5saXN0ZW5lciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBtb2RlbCA9IHNlbGYuX3dhdGNoZXIudmFsdWU7XG4gICAgICBpZiAoaXNBcnJheShtb2RlbCkpIHtcbiAgICAgICAgdmFyIHZhbCA9IHNlbGYuZ2V0VmFsdWUoKTtcbiAgICAgICAgaWYgKGVsLmNoZWNrZWQpIHtcbiAgICAgICAgICBpZiAoaW5kZXhPZihtb2RlbCwgdmFsKSA8IDApIHtcbiAgICAgICAgICAgIG1vZGVsLnB1c2godmFsKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbW9kZWwuJHJlbW92ZSh2YWwpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZWxmLnNldChnZXRCb29sZWFuVmFsdWUoKSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIHRoaXMub24oJ2NoYW5nZScsIHRoaXMubGlzdGVuZXIpO1xuICAgIGlmIChlbC5oYXNBdHRyaWJ1dGUoJ2NoZWNrZWQnKSkge1xuICAgICAgdGhpcy5hZnRlckJpbmQgPSB0aGlzLmxpc3RlbmVyO1xuICAgIH1cbiAgfSxcblxuICB1cGRhdGU6IGZ1bmN0aW9uIHVwZGF0ZSh2YWx1ZSkge1xuICAgIHZhciBlbCA9IHRoaXMuZWw7XG4gICAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgICBlbC5jaGVja2VkID0gaW5kZXhPZih2YWx1ZSwgdGhpcy5nZXRWYWx1ZSgpKSA+IC0xO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoZWwuaGFzT3duUHJvcGVydHkoJ190cnVlVmFsdWUnKSkge1xuICAgICAgICBlbC5jaGVja2VkID0gbG9vc2VFcXVhbCh2YWx1ZSwgZWwuX3RydWVWYWx1ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbC5jaGVja2VkID0gISF2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn07XG5cbnZhciBzZWxlY3QgPSB7XG5cbiAgYmluZDogZnVuY3Rpb24gYmluZCgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGVsID0gdGhpcy5lbDtcblxuICAgIC8vIG1ldGhvZCB0byBmb3JjZSB1cGRhdGUgRE9NIHVzaW5nIGxhdGVzdCB2YWx1ZS5cbiAgICB0aGlzLmZvcmNlVXBkYXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKHNlbGYuX3dhdGNoZXIpIHtcbiAgICAgICAgc2VsZi51cGRhdGUoc2VsZi5fd2F0Y2hlci5nZXQoKSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8vIGNoZWNrIGlmIHRoaXMgaXMgYSBtdWx0aXBsZSBzZWxlY3RcbiAgICB2YXIgbXVsdGlwbGUgPSB0aGlzLm11bHRpcGxlID0gZWwuaGFzQXR0cmlidXRlKCdtdWx0aXBsZScpO1xuXG4gICAgLy8gYXR0YWNoIGxpc3RlbmVyXG4gICAgdGhpcy5saXN0ZW5lciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciB2YWx1ZSA9IGdldFZhbHVlKGVsLCBtdWx0aXBsZSk7XG4gICAgICB2YWx1ZSA9IHNlbGYucGFyYW1zLm51bWJlciA/IGlzQXJyYXkodmFsdWUpID8gdmFsdWUubWFwKHRvTnVtYmVyKSA6IHRvTnVtYmVyKHZhbHVlKSA6IHZhbHVlO1xuICAgICAgc2VsZi5zZXQodmFsdWUpO1xuICAgIH07XG4gICAgdGhpcy5vbignY2hhbmdlJywgdGhpcy5saXN0ZW5lcik7XG5cbiAgICAvLyBpZiBoYXMgaW5pdGlhbCB2YWx1ZSwgc2V0IGFmdGVyQmluZFxuICAgIHZhciBpbml0VmFsdWUgPSBnZXRWYWx1ZShlbCwgbXVsdGlwbGUsIHRydWUpO1xuICAgIGlmIChtdWx0aXBsZSAmJiBpbml0VmFsdWUubGVuZ3RoIHx8ICFtdWx0aXBsZSAmJiBpbml0VmFsdWUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuYWZ0ZXJCaW5kID0gdGhpcy5saXN0ZW5lcjtcbiAgICB9XG5cbiAgICAvLyBBbGwgbWFqb3IgYnJvd3NlcnMgZXhjZXB0IEZpcmVmb3ggcmVzZXRzXG4gICAgLy8gc2VsZWN0ZWRJbmRleCB3aXRoIHZhbHVlIC0xIHRvIDAgd2hlbiB0aGUgZWxlbWVudFxuICAgIC8vIGlzIGFwcGVuZGVkIHRvIGEgbmV3IHBhcmVudCwgdGhlcmVmb3JlIHdlIGhhdmUgdG9cbiAgICAvLyBmb3JjZSBhIERPTSB1cGRhdGUgd2hlbmV2ZXIgdGhhdCBoYXBwZW5zLi4uXG4gICAgdGhpcy52bS4kb24oJ2hvb2s6YXR0YWNoZWQnLCB0aGlzLmZvcmNlVXBkYXRlKTtcbiAgfSxcblxuICB1cGRhdGU6IGZ1bmN0aW9uIHVwZGF0ZSh2YWx1ZSkge1xuICAgIHZhciBlbCA9IHRoaXMuZWw7XG4gICAgZWwuc2VsZWN0ZWRJbmRleCA9IC0xO1xuICAgIHZhciBtdWx0aSA9IHRoaXMubXVsdGlwbGUgJiYgaXNBcnJheSh2YWx1ZSk7XG4gICAgdmFyIG9wdGlvbnMgPSBlbC5vcHRpb25zO1xuICAgIHZhciBpID0gb3B0aW9ucy5sZW5ndGg7XG4gICAgdmFyIG9wLCB2YWw7XG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgb3AgPSBvcHRpb25zW2ldO1xuICAgICAgdmFsID0gb3AuaGFzT3duUHJvcGVydHkoJ192YWx1ZScpID8gb3AuX3ZhbHVlIDogb3AudmFsdWU7XG4gICAgICAvKiBlc2xpbnQtZGlzYWJsZSBlcWVxZXEgKi9cbiAgICAgIG9wLnNlbGVjdGVkID0gbXVsdGkgPyBpbmRleE9mJDEodmFsdWUsIHZhbCkgPiAtMSA6IGxvb3NlRXF1YWwodmFsdWUsIHZhbCk7XG4gICAgICAvKiBlc2xpbnQtZW5hYmxlIGVxZXFlcSAqL1xuICAgIH1cbiAgfSxcblxuICB1bmJpbmQ6IGZ1bmN0aW9uIHVuYmluZCgpIHtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIHRoaXMudm0uJG9mZignaG9vazphdHRhY2hlZCcsIHRoaXMuZm9yY2VVcGRhdGUpO1xuICB9XG59O1xuXG4vKipcbiAqIEdldCBzZWxlY3QgdmFsdWVcbiAqXG4gKiBAcGFyYW0ge1NlbGVjdEVsZW1lbnR9IGVsXG4gKiBAcGFyYW0ge0Jvb2xlYW59IG11bHRpXG4gKiBAcGFyYW0ge0Jvb2xlYW59IGluaXRcbiAqIEByZXR1cm4ge0FycmF5fCp9XG4gKi9cblxuZnVuY3Rpb24gZ2V0VmFsdWUoZWwsIG11bHRpLCBpbml0KSB7XG4gIHZhciByZXMgPSBtdWx0aSA/IFtdIDogbnVsbDtcbiAgdmFyIG9wLCB2YWwsIHNlbGVjdGVkO1xuICBmb3IgKHZhciBpID0gMCwgbCA9IGVsLm9wdGlvbnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgb3AgPSBlbC5vcHRpb25zW2ldO1xuICAgIHNlbGVjdGVkID0gaW5pdCA/IG9wLmhhc0F0dHJpYnV0ZSgnc2VsZWN0ZWQnKSA6IG9wLnNlbGVjdGVkO1xuICAgIGlmIChzZWxlY3RlZCkge1xuICAgICAgdmFsID0gb3AuaGFzT3duUHJvcGVydHkoJ192YWx1ZScpID8gb3AuX3ZhbHVlIDogb3AudmFsdWU7XG4gICAgICBpZiAobXVsdGkpIHtcbiAgICAgICAgcmVzLnB1c2godmFsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB2YWw7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiByZXM7XG59XG5cbi8qKlxuICogTmF0aXZlIEFycmF5LmluZGV4T2YgdXNlcyBzdHJpY3QgZXF1YWwsIGJ1dCBpbiB0aGlzXG4gKiBjYXNlIHdlIG5lZWQgdG8gbWF0Y2ggc3RyaW5nL251bWJlcnMgd2l0aCBjdXN0b20gZXF1YWwuXG4gKlxuICogQHBhcmFtIHtBcnJheX0gYXJyXG4gKiBAcGFyYW0geyp9IHZhbFxuICovXG5cbmZ1bmN0aW9uIGluZGV4T2YkMShhcnIsIHZhbCkge1xuICB2YXIgaSA9IGFyci5sZW5ndGg7XG4gIHdoaWxlIChpLS0pIHtcbiAgICBpZiAobG9vc2VFcXVhbChhcnJbaV0sIHZhbCkpIHtcbiAgICAgIHJldHVybiBpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gLTE7XG59XG5cbnZhciByYWRpbyA9IHtcblxuICBiaW5kOiBmdW5jdGlvbiBiaW5kKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgZWwgPSB0aGlzLmVsO1xuXG4gICAgdGhpcy5nZXRWYWx1ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIC8vIHZhbHVlIG92ZXJ3cml0ZSB2aWEgdi1iaW5kOnZhbHVlXG4gICAgICBpZiAoZWwuaGFzT3duUHJvcGVydHkoJ192YWx1ZScpKSB7XG4gICAgICAgIHJldHVybiBlbC5fdmFsdWU7XG4gICAgICB9XG4gICAgICB2YXIgdmFsID0gZWwudmFsdWU7XG4gICAgICBpZiAoc2VsZi5wYXJhbXMubnVtYmVyKSB7XG4gICAgICAgIHZhbCA9IHRvTnVtYmVyKHZhbCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdmFsO1xuICAgIH07XG5cbiAgICB0aGlzLmxpc3RlbmVyID0gZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5zZXQoc2VsZi5nZXRWYWx1ZSgpKTtcbiAgICB9O1xuICAgIHRoaXMub24oJ2NoYW5nZScsIHRoaXMubGlzdGVuZXIpO1xuXG4gICAgaWYgKGVsLmhhc0F0dHJpYnV0ZSgnY2hlY2tlZCcpKSB7XG4gICAgICB0aGlzLmFmdGVyQmluZCA9IHRoaXMubGlzdGVuZXI7XG4gICAgfVxuICB9LFxuXG4gIHVwZGF0ZTogZnVuY3Rpb24gdXBkYXRlKHZhbHVlKSB7XG4gICAgdGhpcy5lbC5jaGVja2VkID0gbG9vc2VFcXVhbCh2YWx1ZSwgdGhpcy5nZXRWYWx1ZSgpKTtcbiAgfVxufTtcblxudmFyIHRleHQkMiA9IHtcblxuICBiaW5kOiBmdW5jdGlvbiBiaW5kKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgZWwgPSB0aGlzLmVsO1xuICAgIHZhciBpc1JhbmdlID0gZWwudHlwZSA9PT0gJ3JhbmdlJztcbiAgICB2YXIgbGF6eSA9IHRoaXMucGFyYW1zLmxhenk7XG4gICAgdmFyIG51bWJlciA9IHRoaXMucGFyYW1zLm51bWJlcjtcbiAgICB2YXIgZGVib3VuY2UgPSB0aGlzLnBhcmFtcy5kZWJvdW5jZTtcblxuICAgIC8vIGhhbmRsZSBjb21wb3NpdGlvbiBldmVudHMuXG4gICAgLy8gICBodHRwOi8vYmxvZy5ldmFueW91Lm1lLzIwMTQvMDEvMDMvY29tcG9zaXRpb24tZXZlbnQvXG4gICAgLy8gc2tpcCB0aGlzIGZvciBBbmRyb2lkIGJlY2F1c2UgaXQgaGFuZGxlcyBjb21wb3NpdGlvblxuICAgIC8vIGV2ZW50cyBxdWl0ZSBkaWZmZXJlbnRseS4gQW5kcm9pZCBkb2Vzbid0IHRyaWdnZXJcbiAgICAvLyBjb21wb3NpdGlvbiBldmVudHMgZm9yIGxhbmd1YWdlIGlucHV0IG1ldGhvZHMgZS5nLlxuICAgIC8vIENoaW5lc2UsIGJ1dCBpbnN0ZWFkIHRyaWdnZXJzIHRoZW0gZm9yIHNwZWxsaW5nXG4gICAgLy8gc3VnZ2VzdGlvbnMuLi4gKHNlZSBEaXNjdXNzaW9uLyMxNjIpXG4gICAgdmFyIGNvbXBvc2luZyA9IGZhbHNlO1xuICAgIGlmICghaXNBbmRyb2lkICYmICFpc1JhbmdlKSB7XG4gICAgICB0aGlzLm9uKCdjb21wb3NpdGlvbnN0YXJ0JywgZnVuY3Rpb24gKCkge1xuICAgICAgICBjb21wb3NpbmcgPSB0cnVlO1xuICAgICAgfSk7XG4gICAgICB0aGlzLm9uKCdjb21wb3NpdGlvbmVuZCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY29tcG9zaW5nID0gZmFsc2U7XG4gICAgICAgIC8vIGluIElFMTEgdGhlIFwiY29tcG9zaXRpb25lbmRcIiBldmVudCBmaXJlcyBBRlRFUlxuICAgICAgICAvLyB0aGUgXCJpbnB1dFwiIGV2ZW50LCBzbyB0aGUgaW5wdXQgaGFuZGxlciBpcyBibG9ja2VkXG4gICAgICAgIC8vIGF0IHRoZSBlbmQuLi4gaGF2ZSB0byBjYWxsIGl0IGhlcmUuXG4gICAgICAgIC8vXG4gICAgICAgIC8vICMxMzI3OiBpbiBsYXp5IG1vZGUgdGhpcyBpcyB1bmVjZXNzYXJ5LlxuICAgICAgICBpZiAoIWxhenkpIHtcbiAgICAgICAgICBzZWxmLmxpc3RlbmVyKCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIHByZXZlbnQgbWVzc2luZyB3aXRoIHRoZSBpbnB1dCB3aGVuIHVzZXIgaXMgdHlwaW5nLFxuICAgIC8vIGFuZCBmb3JjZSB1cGRhdGUgb24gYmx1ci5cbiAgICB0aGlzLmZvY3VzZWQgPSBmYWxzZTtcbiAgICBpZiAoIWlzUmFuZ2UpIHtcbiAgICAgIHRoaXMub24oJ2ZvY3VzJywgZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWxmLmZvY3VzZWQgPSB0cnVlO1xuICAgICAgfSk7XG4gICAgICB0aGlzLm9uKCdibHVyJywgZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWxmLmZvY3VzZWQgPSBmYWxzZTtcbiAgICAgICAgLy8gZG8gbm90IHN5bmMgdmFsdWUgYWZ0ZXIgZnJhZ21lbnQgcmVtb3ZhbCAoIzIwMTcpXG4gICAgICAgIGlmICghc2VsZi5fZnJhZyB8fCBzZWxmLl9mcmFnLmluc2VydGVkKSB7XG4gICAgICAgICAgc2VsZi5yYXdMaXN0ZW5lcigpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBOb3cgYXR0YWNoIHRoZSBtYWluIGxpc3RlbmVyXG4gICAgdGhpcy5saXN0ZW5lciA9IHRoaXMucmF3TGlzdGVuZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoY29tcG9zaW5nIHx8ICFzZWxmLl9ib3VuZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB2YXIgdmFsID0gbnVtYmVyIHx8IGlzUmFuZ2UgPyB0b051bWJlcihlbC52YWx1ZSkgOiBlbC52YWx1ZTtcbiAgICAgIHNlbGYuc2V0KHZhbCk7XG4gICAgICAvLyBmb3JjZSB1cGRhdGUgb24gbmV4dCB0aWNrIHRvIGF2b2lkIGxvY2sgJiBzYW1lIHZhbHVlXG4gICAgICAvLyBhbHNvIG9ubHkgdXBkYXRlIHdoZW4gdXNlciBpcyBub3QgdHlwaW5nXG4gICAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChzZWxmLl9ib3VuZCAmJiAhc2VsZi5mb2N1c2VkKSB7XG4gICAgICAgICAgc2VsZi51cGRhdGUoc2VsZi5fd2F0Y2hlci52YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvLyBhcHBseSBkZWJvdW5jZVxuICAgIGlmIChkZWJvdW5jZSkge1xuICAgICAgdGhpcy5saXN0ZW5lciA9IF9kZWJvdW5jZSh0aGlzLmxpc3RlbmVyLCBkZWJvdW5jZSk7XG4gICAgfVxuXG4gICAgLy8gU3VwcG9ydCBqUXVlcnkgZXZlbnRzLCBzaW5jZSBqUXVlcnkudHJpZ2dlcigpIGRvZXNuJ3RcbiAgICAvLyB0cmlnZ2VyIG5hdGl2ZSBldmVudHMgaW4gc29tZSBjYXNlcyBhbmQgc29tZSBwbHVnaW5zXG4gICAgLy8gcmVseSBvbiAkLnRyaWdnZXIoKVxuICAgIC8vXG4gICAgLy8gV2Ugd2FudCB0byBtYWtlIHN1cmUgaWYgYSBsaXN0ZW5lciBpcyBhdHRhY2hlZCB1c2luZ1xuICAgIC8vIGpRdWVyeSwgaXQgaXMgYWxzbyByZW1vdmVkIHdpdGggalF1ZXJ5LCB0aGF0J3Mgd2h5XG4gICAgLy8gd2UgZG8gdGhlIGNoZWNrIGZvciBlYWNoIGRpcmVjdGl2ZSBpbnN0YW5jZSBhbmRcbiAgICAvLyBzdG9yZSB0aGF0IGNoZWNrIHJlc3VsdCBvbiBpdHNlbGYuIFRoaXMgYWxzbyBhbGxvd3NcbiAgICAvLyBlYXNpZXIgdGVzdCBjb3ZlcmFnZSBjb250cm9sIGJ5IHVuc2V0dGluZyB0aGUgZ2xvYmFsXG4gICAgLy8galF1ZXJ5IHZhcmlhYmxlIGluIHRlc3RzLlxuICAgIHRoaXMuaGFzalF1ZXJ5ID0gdHlwZW9mIGpRdWVyeSA9PT0gJ2Z1bmN0aW9uJztcbiAgICBpZiAodGhpcy5oYXNqUXVlcnkpIHtcbiAgICAgIGpRdWVyeShlbCkub24oJ2NoYW5nZScsIHRoaXMubGlzdGVuZXIpO1xuICAgICAgaWYgKCFsYXp5KSB7XG4gICAgICAgIGpRdWVyeShlbCkub24oJ2lucHV0JywgdGhpcy5saXN0ZW5lcik7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub24oJ2NoYW5nZScsIHRoaXMubGlzdGVuZXIpO1xuICAgICAgaWYgKCFsYXp5KSB7XG4gICAgICAgIHRoaXMub24oJ2lucHV0JywgdGhpcy5saXN0ZW5lcik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSUU5IGRvZXNuJ3QgZmlyZSBpbnB1dCBldmVudCBvbiBiYWNrc3BhY2UvZGVsL2N1dFxuICAgIGlmICghbGF6eSAmJiBpc0lFOSkge1xuICAgICAgdGhpcy5vbignY3V0JywgZnVuY3Rpb24gKCkge1xuICAgICAgICBuZXh0VGljayhzZWxmLmxpc3RlbmVyKTtcbiAgICAgIH0pO1xuICAgICAgdGhpcy5vbigna2V5dXAnLCBmdW5jdGlvbiAoZSkge1xuICAgICAgICBpZiAoZS5rZXlDb2RlID09PSA0NiB8fCBlLmtleUNvZGUgPT09IDgpIHtcbiAgICAgICAgICBzZWxmLmxpc3RlbmVyKCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIHNldCBpbml0aWFsIHZhbHVlIGlmIHByZXNlbnRcbiAgICBpZiAoZWwuaGFzQXR0cmlidXRlKCd2YWx1ZScpIHx8IGVsLnRhZ05hbWUgPT09ICdURVhUQVJFQScgJiYgZWwudmFsdWUudHJpbSgpKSB7XG4gICAgICB0aGlzLmFmdGVyQmluZCA9IHRoaXMubGlzdGVuZXI7XG4gICAgfVxuICB9LFxuXG4gIHVwZGF0ZTogZnVuY3Rpb24gdXBkYXRlKHZhbHVlKSB7XG4gICAgdGhpcy5lbC52YWx1ZSA9IF90b1N0cmluZyh2YWx1ZSk7XG4gIH0sXG5cbiAgdW5iaW5kOiBmdW5jdGlvbiB1bmJpbmQoKSB7XG4gICAgdmFyIGVsID0gdGhpcy5lbDtcbiAgICBpZiAodGhpcy5oYXNqUXVlcnkpIHtcbiAgICAgIGpRdWVyeShlbCkub2ZmKCdjaGFuZ2UnLCB0aGlzLmxpc3RlbmVyKTtcbiAgICAgIGpRdWVyeShlbCkub2ZmKCdpbnB1dCcsIHRoaXMubGlzdGVuZXIpO1xuICAgIH1cbiAgfVxufTtcblxudmFyIGhhbmRsZXJzID0ge1xuICB0ZXh0OiB0ZXh0JDIsXG4gIHJhZGlvOiByYWRpbyxcbiAgc2VsZWN0OiBzZWxlY3QsXG4gIGNoZWNrYm94OiBjaGVja2JveFxufTtcblxudmFyIG1vZGVsID0ge1xuXG4gIHByaW9yaXR5OiBNT0RFTCxcbiAgdHdvV2F5OiB0cnVlLFxuICBoYW5kbGVyczogaGFuZGxlcnMsXG4gIHBhcmFtczogWydsYXp5JywgJ251bWJlcicsICdkZWJvdW5jZSddLFxuXG4gIC8qKlxuICAgKiBQb3NzaWJsZSBlbGVtZW50czpcbiAgICogICA8c2VsZWN0PlxuICAgKiAgIDx0ZXh0YXJlYT5cbiAgICogICA8aW5wdXQgdHlwZT1cIipcIj5cbiAgICogICAgIC0gdGV4dFxuICAgKiAgICAgLSBjaGVja2JveFxuICAgKiAgICAgLSByYWRpb1xuICAgKiAgICAgLSBudW1iZXJcbiAgICovXG5cbiAgYmluZDogZnVuY3Rpb24gYmluZCgpIHtcbiAgICAvLyBmcmllbmRseSB3YXJuaW5nLi4uXG4gICAgdGhpcy5jaGVja0ZpbHRlcnMoKTtcbiAgICBpZiAodGhpcy5oYXNSZWFkICYmICF0aGlzLmhhc1dyaXRlKSB7XG4gICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHdhcm4oJ0l0IHNlZW1zIHlvdSBhcmUgdXNpbmcgYSByZWFkLW9ubHkgZmlsdGVyIHdpdGggJyArICd2LW1vZGVsLiBZb3UgbWlnaHQgd2FudCB0byB1c2UgYSB0d28td2F5IGZpbHRlciAnICsgJ3RvIGVuc3VyZSBjb3JyZWN0IGJlaGF2aW9yLicpO1xuICAgIH1cbiAgICB2YXIgZWwgPSB0aGlzLmVsO1xuICAgIHZhciB0YWcgPSBlbC50YWdOYW1lO1xuICAgIHZhciBoYW5kbGVyO1xuICAgIGlmICh0YWcgPT09ICdJTlBVVCcpIHtcbiAgICAgIGhhbmRsZXIgPSBoYW5kbGVyc1tlbC50eXBlXSB8fCBoYW5kbGVycy50ZXh0O1xuICAgIH0gZWxzZSBpZiAodGFnID09PSAnU0VMRUNUJykge1xuICAgICAgaGFuZGxlciA9IGhhbmRsZXJzLnNlbGVjdDtcbiAgICB9IGVsc2UgaWYgKHRhZyA9PT0gJ1RFWFRBUkVBJykge1xuICAgICAgaGFuZGxlciA9IGhhbmRsZXJzLnRleHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgd2Fybigndi1tb2RlbCBkb2VzIG5vdCBzdXBwb3J0IGVsZW1lbnQgdHlwZTogJyArIHRhZyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGVsLl9fdl9tb2RlbCA9IHRoaXM7XG4gICAgaGFuZGxlci5iaW5kLmNhbGwodGhpcyk7XG4gICAgdGhpcy51cGRhdGUgPSBoYW5kbGVyLnVwZGF0ZTtcbiAgICB0aGlzLl91bmJpbmQgPSBoYW5kbGVyLnVuYmluZDtcbiAgfSxcblxuICAvKipcbiAgICogQ2hlY2sgcmVhZC93cml0ZSBmaWx0ZXIgc3RhdHMuXG4gICAqL1xuXG4gIGNoZWNrRmlsdGVyczogZnVuY3Rpb24gY2hlY2tGaWx0ZXJzKCkge1xuICAgIHZhciBmaWx0ZXJzID0gdGhpcy5maWx0ZXJzO1xuICAgIGlmICghZmlsdGVycykgcmV0dXJuO1xuICAgIHZhciBpID0gZmlsdGVycy5sZW5ndGg7XG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgdmFyIGZpbHRlciA9IHJlc29sdmVBc3NldCh0aGlzLnZtLiRvcHRpb25zLCAnZmlsdGVycycsIGZpbHRlcnNbaV0ubmFtZSk7XG4gICAgICBpZiAodHlwZW9mIGZpbHRlciA9PT0gJ2Z1bmN0aW9uJyB8fCBmaWx0ZXIucmVhZCkge1xuICAgICAgICB0aGlzLmhhc1JlYWQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgaWYgKGZpbHRlci53cml0ZSkge1xuICAgICAgICB0aGlzLmhhc1dyaXRlID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgdW5iaW5kOiBmdW5jdGlvbiB1bmJpbmQoKSB7XG4gICAgdGhpcy5lbC5fX3ZfbW9kZWwgPSBudWxsO1xuICAgIHRoaXMuX3VuYmluZCAmJiB0aGlzLl91bmJpbmQoKTtcbiAgfVxufTtcblxudmFyIHNob3cgPSB7XG5cbiAgYmluZDogZnVuY3Rpb24gYmluZCgpIHtcbiAgICAvLyBjaGVjayBlbHNlIGJsb2NrXG4gICAgdmFyIG5leHQgPSB0aGlzLmVsLm5leHRFbGVtZW50U2libGluZztcbiAgICBpZiAobmV4dCAmJiBnZXRBdHRyKG5leHQsICd2LWVsc2UnKSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5lbHNlRWwgPSBuZXh0O1xuICAgIH1cbiAgfSxcblxuICB1cGRhdGU6IGZ1bmN0aW9uIHVwZGF0ZSh2YWx1ZSkge1xuICAgIHRoaXMuYXBwbHkodGhpcy5lbCwgdmFsdWUpO1xuICAgIGlmICh0aGlzLmVsc2VFbCkge1xuICAgICAgdGhpcy5hcHBseSh0aGlzLmVsc2VFbCwgIXZhbHVlKTtcbiAgICB9XG4gIH0sXG5cbiAgYXBwbHk6IGZ1bmN0aW9uIGFwcGx5KGVsLCB2YWx1ZSkge1xuICAgIGlmIChpbkRvYyhlbCkpIHtcbiAgICAgIGFwcGx5VHJhbnNpdGlvbihlbCwgdmFsdWUgPyAxIDogLTEsIHRvZ2dsZSwgdGhpcy52bSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRvZ2dsZSgpO1xuICAgIH1cbiAgICBmdW5jdGlvbiB0b2dnbGUoKSB7XG4gICAgICBlbC5zdHlsZS5kaXNwbGF5ID0gdmFsdWUgPyAnJyA6ICdub25lJztcbiAgICB9XG4gIH1cbn07XG5cbnZhciB0ZW1wbGF0ZUNhY2hlID0gbmV3IENhY2hlKDEwMDApO1xudmFyIGlkU2VsZWN0b3JDYWNoZSA9IG5ldyBDYWNoZSgxMDAwKTtcblxudmFyIG1hcCA9IHtcbiAgZWZhdWx0OiBbMCwgJycsICcnXSxcbiAgbGVnZW5kOiBbMSwgJzxmaWVsZHNldD4nLCAnPC9maWVsZHNldD4nXSxcbiAgdHI6IFsyLCAnPHRhYmxlPjx0Ym9keT4nLCAnPC90Ym9keT48L3RhYmxlPiddLFxuICBjb2w6IFsyLCAnPHRhYmxlPjx0Ym9keT48L3Rib2R5Pjxjb2xncm91cD4nLCAnPC9jb2xncm91cD48L3RhYmxlPiddXG59O1xuXG5tYXAudGQgPSBtYXAudGggPSBbMywgJzx0YWJsZT48dGJvZHk+PHRyPicsICc8L3RyPjwvdGJvZHk+PC90YWJsZT4nXTtcblxubWFwLm9wdGlvbiA9IG1hcC5vcHRncm91cCA9IFsxLCAnPHNlbGVjdCBtdWx0aXBsZT1cIm11bHRpcGxlXCI+JywgJzwvc2VsZWN0PiddO1xuXG5tYXAudGhlYWQgPSBtYXAudGJvZHkgPSBtYXAuY29sZ3JvdXAgPSBtYXAuY2FwdGlvbiA9IG1hcC50Zm9vdCA9IFsxLCAnPHRhYmxlPicsICc8L3RhYmxlPiddO1xuXG5tYXAuZyA9IG1hcC5kZWZzID0gbWFwLnN5bWJvbCA9IG1hcC51c2UgPSBtYXAuaW1hZ2UgPSBtYXAudGV4dCA9IG1hcC5jaXJjbGUgPSBtYXAuZWxsaXBzZSA9IG1hcC5saW5lID0gbWFwLnBhdGggPSBtYXAucG9seWdvbiA9IG1hcC5wb2x5bGluZSA9IG1hcC5yZWN0ID0gWzEsICc8c3ZnICcgKyAneG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiICcgKyAneG1sbnM6eGxpbms9XCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCIgJyArICd4bWxuczpldj1cImh0dHA6Ly93d3cudzMub3JnLzIwMDEveG1sLWV2ZW50c1wiJyArICd2ZXJzaW9uPVwiMS4xXCI+JywgJzwvc3ZnPiddO1xuXG4vKipcbiAqIENoZWNrIGlmIGEgbm9kZSBpcyBhIHN1cHBvcnRlZCB0ZW1wbGF0ZSBub2RlIHdpdGggYVxuICogRG9jdW1lbnRGcmFnbWVudCBjb250ZW50LlxuICpcbiAqIEBwYXJhbSB7Tm9kZX0gbm9kZVxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqL1xuXG5mdW5jdGlvbiBpc1JlYWxUZW1wbGF0ZShub2RlKSB7XG4gIHJldHVybiBpc1RlbXBsYXRlKG5vZGUpICYmIG5vZGUuY29udGVudCBpbnN0YW5jZW9mIERvY3VtZW50RnJhZ21lbnQ7XG59XG5cbnZhciB0YWdSRSQxID0gLzwoW1xcdzpdKykvO1xudmFyIGVudGl0eVJFID0gLyYjP1xcdys/Oy87XG5cbi8qKlxuICogQ29udmVydCBhIHN0cmluZyB0ZW1wbGF0ZSB0byBhIERvY3VtZW50RnJhZ21lbnQuXG4gKiBEZXRlcm1pbmVzIGNvcnJlY3Qgd3JhcHBpbmcgYnkgdGFnIHR5cGVzLiBXcmFwcGluZ1xuICogc3RyYXRlZ3kgZm91bmQgaW4galF1ZXJ5ICYgY29tcG9uZW50L2RvbWlmeS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdGVtcGxhdGVTdHJpbmdcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gcmF3XG4gKiBAcmV0dXJuIHtEb2N1bWVudEZyYWdtZW50fVxuICovXG5cbmZ1bmN0aW9uIHN0cmluZ1RvRnJhZ21lbnQodGVtcGxhdGVTdHJpbmcsIHJhdykge1xuICAvLyB0cnkgYSBjYWNoZSBoaXQgZmlyc3RcbiAgdmFyIGhpdCA9IHRlbXBsYXRlQ2FjaGUuZ2V0KHRlbXBsYXRlU3RyaW5nKTtcbiAgaWYgKGhpdCkge1xuICAgIHJldHVybiBoaXQ7XG4gIH1cblxuICB2YXIgZnJhZyA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgdmFyIHRhZ01hdGNoID0gdGVtcGxhdGVTdHJpbmcubWF0Y2godGFnUkUkMSk7XG4gIHZhciBlbnRpdHlNYXRjaCA9IGVudGl0eVJFLnRlc3QodGVtcGxhdGVTdHJpbmcpO1xuXG4gIGlmICghdGFnTWF0Y2ggJiYgIWVudGl0eU1hdGNoKSB7XG4gICAgLy8gdGV4dCBvbmx5LCByZXR1cm4gYSBzaW5nbGUgdGV4dCBub2RlLlxuICAgIGZyYWcuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodGVtcGxhdGVTdHJpbmcpKTtcbiAgfSBlbHNlIHtcblxuICAgIHZhciB0YWcgPSB0YWdNYXRjaCAmJiB0YWdNYXRjaFsxXTtcbiAgICB2YXIgd3JhcCA9IG1hcFt0YWddIHx8IG1hcC5lZmF1bHQ7XG4gICAgdmFyIGRlcHRoID0gd3JhcFswXTtcbiAgICB2YXIgcHJlZml4ID0gd3JhcFsxXTtcbiAgICB2YXIgc3VmZml4ID0gd3JhcFsyXTtcbiAgICB2YXIgbm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG4gICAgaWYgKCFyYXcpIHtcbiAgICAgIHRlbXBsYXRlU3RyaW5nID0gdGVtcGxhdGVTdHJpbmcudHJpbSgpO1xuICAgIH1cbiAgICBub2RlLmlubmVySFRNTCA9IHByZWZpeCArIHRlbXBsYXRlU3RyaW5nICsgc3VmZml4O1xuICAgIHdoaWxlIChkZXB0aC0tKSB7XG4gICAgICBub2RlID0gbm9kZS5sYXN0Q2hpbGQ7XG4gICAgfVxuXG4gICAgdmFyIGNoaWxkO1xuICAgIC8qIGVzbGludC1kaXNhYmxlIG5vLWNvbmQtYXNzaWduICovXG4gICAgd2hpbGUgKGNoaWxkID0gbm9kZS5maXJzdENoaWxkKSB7XG4gICAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLWNvbmQtYXNzaWduICovXG4gICAgICBmcmFnLmFwcGVuZENoaWxkKGNoaWxkKTtcbiAgICB9XG4gIH1cblxuICB0ZW1wbGF0ZUNhY2hlLnB1dCh0ZW1wbGF0ZVN0cmluZywgZnJhZyk7XG4gIHJldHVybiBmcmFnO1xufVxuXG4vKipcbiAqIENvbnZlcnQgYSB0ZW1wbGF0ZSBub2RlIHRvIGEgRG9jdW1lbnRGcmFnbWVudC5cbiAqXG4gKiBAcGFyYW0ge05vZGV9IG5vZGVcbiAqIEByZXR1cm4ge0RvY3VtZW50RnJhZ21lbnR9XG4gKi9cblxuZnVuY3Rpb24gbm9kZVRvRnJhZ21lbnQobm9kZSkge1xuICAvLyBpZiBpdHMgYSB0ZW1wbGF0ZSB0YWcgYW5kIHRoZSBicm93c2VyIHN1cHBvcnRzIGl0LFxuICAvLyBpdHMgY29udGVudCBpcyBhbHJlYWR5IGEgZG9jdW1lbnQgZnJhZ21lbnQuXG4gIGlmIChpc1JlYWxUZW1wbGF0ZShub2RlKSkge1xuICAgIHRyaW1Ob2RlKG5vZGUuY29udGVudCk7XG4gICAgcmV0dXJuIG5vZGUuY29udGVudDtcbiAgfVxuICAvLyBzY3JpcHQgdGVtcGxhdGVcbiAgaWYgKG5vZGUudGFnTmFtZSA9PT0gJ1NDUklQVCcpIHtcbiAgICByZXR1cm4gc3RyaW5nVG9GcmFnbWVudChub2RlLnRleHRDb250ZW50KTtcbiAgfVxuICAvLyBub3JtYWwgbm9kZSwgY2xvbmUgaXQgdG8gYXZvaWQgbXV0YXRpbmcgdGhlIG9yaWdpbmFsXG4gIHZhciBjbG9uZWROb2RlID0gY2xvbmVOb2RlKG5vZGUpO1xuICB2YXIgZnJhZyA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgdmFyIGNoaWxkO1xuICAvKiBlc2xpbnQtZGlzYWJsZSBuby1jb25kLWFzc2lnbiAqL1xuICB3aGlsZSAoY2hpbGQgPSBjbG9uZWROb2RlLmZpcnN0Q2hpbGQpIHtcbiAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLWNvbmQtYXNzaWduICovXG4gICAgZnJhZy5hcHBlbmRDaGlsZChjaGlsZCk7XG4gIH1cbiAgdHJpbU5vZGUoZnJhZyk7XG4gIHJldHVybiBmcmFnO1xufVxuXG4vLyBUZXN0IGZvciB0aGUgcHJlc2VuY2Ugb2YgdGhlIFNhZmFyaSB0ZW1wbGF0ZSBjbG9uaW5nIGJ1Z1xuLy8gaHR0cHM6Ly9idWdzLndlYmtpdC5vcmcvc2hvd3VnLmNnaT9pZD0xMzc3NTVcbnZhciBoYXNCcm9rZW5UZW1wbGF0ZSA9IChmdW5jdGlvbiAoKSB7XG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBlbHNlICovXG4gIGlmIChpbkJyb3dzZXIpIHtcbiAgICB2YXIgYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGEuaW5uZXJIVE1MID0gJzx0ZW1wbGF0ZT4xPC90ZW1wbGF0ZT4nO1xuICAgIHJldHVybiAhYS5jbG9uZU5vZGUodHJ1ZSkuZmlyc3RDaGlsZC5pbm5lckhUTUw7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59KSgpO1xuXG4vLyBUZXN0IGZvciBJRTEwLzExIHRleHRhcmVhIHBsYWNlaG9sZGVyIGNsb25lIGJ1Z1xudmFyIGhhc1RleHRhcmVhQ2xvbmVCdWcgPSAoZnVuY3Rpb24gKCkge1xuICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xuICBpZiAoaW5Ccm93c2VyKSB7XG4gICAgdmFyIHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0ZXh0YXJlYScpO1xuICAgIHQucGxhY2Vob2xkZXIgPSAndCc7XG4gICAgcmV0dXJuIHQuY2xvbmVOb2RlKHRydWUpLnZhbHVlID09PSAndCc7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59KSgpO1xuXG4vKipcbiAqIDEuIERlYWwgd2l0aCBTYWZhcmkgY2xvbmluZyBuZXN0ZWQgPHRlbXBsYXRlPiBidWcgYnlcbiAqICAgIG1hbnVhbGx5IGNsb25pbmcgYWxsIHRlbXBsYXRlIGluc3RhbmNlcy5cbiAqIDIuIERlYWwgd2l0aCBJRTEwLzExIHRleHRhcmVhIHBsYWNlaG9sZGVyIGJ1ZyBieSBzZXR0aW5nXG4gKiAgICB0aGUgY29ycmVjdCB2YWx1ZSBhZnRlciBjbG9uaW5nLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudHxEb2N1bWVudEZyYWdtZW50fSBub2RlXG4gKiBAcmV0dXJuIHtFbGVtZW50fERvY3VtZW50RnJhZ21lbnR9XG4gKi9cblxuZnVuY3Rpb24gY2xvbmVOb2RlKG5vZGUpIHtcbiAgaWYgKCFub2RlLnF1ZXJ5U2VsZWN0b3JBbGwpIHtcbiAgICByZXR1cm4gbm9kZS5jbG9uZU5vZGUoKTtcbiAgfVxuICB2YXIgcmVzID0gbm9kZS5jbG9uZU5vZGUodHJ1ZSk7XG4gIHZhciBpLCBvcmlnaW5hbCwgY2xvbmVkO1xuICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgaWYgKGhhc0Jyb2tlblRlbXBsYXRlKSB7XG4gICAgdmFyIHRlbXBDbG9uZSA9IHJlcztcbiAgICBpZiAoaXNSZWFsVGVtcGxhdGUobm9kZSkpIHtcbiAgICAgIG5vZGUgPSBub2RlLmNvbnRlbnQ7XG4gICAgICB0ZW1wQ2xvbmUgPSByZXMuY29udGVudDtcbiAgICB9XG4gICAgb3JpZ2luYWwgPSBub2RlLnF1ZXJ5U2VsZWN0b3JBbGwoJ3RlbXBsYXRlJyk7XG4gICAgaWYgKG9yaWdpbmFsLmxlbmd0aCkge1xuICAgICAgY2xvbmVkID0gdGVtcENsb25lLnF1ZXJ5U2VsZWN0b3JBbGwoJ3RlbXBsYXRlJyk7XG4gICAgICBpID0gY2xvbmVkLmxlbmd0aDtcbiAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgY2xvbmVkW2ldLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKGNsb25lTm9kZShvcmlnaW5hbFtpXSksIGNsb25lZFtpXSk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICBpZiAoaGFzVGV4dGFyZWFDbG9uZUJ1Zykge1xuICAgIGlmIChub2RlLnRhZ05hbWUgPT09ICdURVhUQVJFQScpIHtcbiAgICAgIHJlcy52YWx1ZSA9IG5vZGUudmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9yaWdpbmFsID0gbm9kZS5xdWVyeVNlbGVjdG9yQWxsKCd0ZXh0YXJlYScpO1xuICAgICAgaWYgKG9yaWdpbmFsLmxlbmd0aCkge1xuICAgICAgICBjbG9uZWQgPSByZXMucXVlcnlTZWxlY3RvckFsbCgndGV4dGFyZWEnKTtcbiAgICAgICAgaSA9IGNsb25lZC5sZW5ndGg7XG4gICAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgICBjbG9uZWRbaV0udmFsdWUgPSBvcmlnaW5hbFtpXS52YWx1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzO1xufVxuXG4vKipcbiAqIFByb2Nlc3MgdGhlIHRlbXBsYXRlIG9wdGlvbiBhbmQgbm9ybWFsaXplcyBpdCBpbnRvIGFcbiAqIGEgRG9jdW1lbnRGcmFnbWVudCB0aGF0IGNhbiBiZSB1c2VkIGFzIGEgcGFydGlhbCBvciBhXG4gKiBpbnN0YW5jZSB0ZW1wbGF0ZS5cbiAqXG4gKiBAcGFyYW0geyp9IHRlbXBsYXRlXG4gKiAgICAgICAgUG9zc2libGUgdmFsdWVzIGluY2x1ZGU6XG4gKiAgICAgICAgLSBEb2N1bWVudEZyYWdtZW50IG9iamVjdFxuICogICAgICAgIC0gTm9kZSBvYmplY3Qgb2YgdHlwZSBUZW1wbGF0ZVxuICogICAgICAgIC0gaWQgc2VsZWN0b3I6ICcjc29tZS10ZW1wbGF0ZS1pZCdcbiAqICAgICAgICAtIHRlbXBsYXRlIHN0cmluZzogJzxkaXY+PHNwYW4+e3ttc2d9fTwvc3Bhbj48L2Rpdj4nXG4gKiBAcGFyYW0ge0Jvb2xlYW59IHNob3VsZENsb25lXG4gKiBAcGFyYW0ge0Jvb2xlYW59IHJhd1xuICogICAgICAgIGlubGluZSBIVE1MIGludGVycG9sYXRpb24uIERvIG5vdCBjaGVjayBmb3IgaWRcbiAqICAgICAgICBzZWxlY3RvciBhbmQga2VlcCB3aGl0ZXNwYWNlIGluIHRoZSBzdHJpbmcuXG4gKiBAcmV0dXJuIHtEb2N1bWVudEZyYWdtZW50fHVuZGVmaW5lZH1cbiAqL1xuXG5mdW5jdGlvbiBwYXJzZVRlbXBsYXRlKHRlbXBsYXRlLCBzaG91bGRDbG9uZSwgcmF3KSB7XG4gIHZhciBub2RlLCBmcmFnO1xuXG4gIC8vIGlmIHRoZSB0ZW1wbGF0ZSBpcyBhbHJlYWR5IGEgZG9jdW1lbnQgZnJhZ21lbnQsXG4gIC8vIGRvIG5vdGhpbmdcbiAgaWYgKHRlbXBsYXRlIGluc3RhbmNlb2YgRG9jdW1lbnRGcmFnbWVudCkge1xuICAgIHRyaW1Ob2RlKHRlbXBsYXRlKTtcbiAgICByZXR1cm4gc2hvdWxkQ2xvbmUgPyBjbG9uZU5vZGUodGVtcGxhdGUpIDogdGVtcGxhdGU7XG4gIH1cblxuICBpZiAodHlwZW9mIHRlbXBsYXRlID09PSAnc3RyaW5nJykge1xuICAgIC8vIGlkIHNlbGVjdG9yXG4gICAgaWYgKCFyYXcgJiYgdGVtcGxhdGUuY2hhckF0KDApID09PSAnIycpIHtcbiAgICAgIC8vIGlkIHNlbGVjdG9yIGNhbiBiZSBjYWNoZWQgdG9vXG4gICAgICBmcmFnID0gaWRTZWxlY3RvckNhY2hlLmdldCh0ZW1wbGF0ZSk7XG4gICAgICBpZiAoIWZyYWcpIHtcbiAgICAgICAgbm9kZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHRlbXBsYXRlLnNsaWNlKDEpKTtcbiAgICAgICAgaWYgKG5vZGUpIHtcbiAgICAgICAgICBmcmFnID0gbm9kZVRvRnJhZ21lbnQobm9kZSk7XG4gICAgICAgICAgLy8gc2F2ZSBzZWxlY3RvciB0byBjYWNoZVxuICAgICAgICAgIGlkU2VsZWN0b3JDYWNoZS5wdXQodGVtcGxhdGUsIGZyYWcpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIG5vcm1hbCBzdHJpbmcgdGVtcGxhdGVcbiAgICAgIGZyYWcgPSBzdHJpbmdUb0ZyYWdtZW50KHRlbXBsYXRlLCByYXcpO1xuICAgIH1cbiAgfSBlbHNlIGlmICh0ZW1wbGF0ZS5ub2RlVHlwZSkge1xuICAgIC8vIGEgZGlyZWN0IG5vZGVcbiAgICBmcmFnID0gbm9kZVRvRnJhZ21lbnQodGVtcGxhdGUpO1xuICB9XG5cbiAgcmV0dXJuIGZyYWcgJiYgc2hvdWxkQ2xvbmUgPyBjbG9uZU5vZGUoZnJhZykgOiBmcmFnO1xufVxuXG52YXIgdGVtcGxhdGUgPSBPYmplY3QuZnJlZXplKHtcbiAgY2xvbmVOb2RlOiBjbG9uZU5vZGUsXG4gIHBhcnNlVGVtcGxhdGU6IHBhcnNlVGVtcGxhdGVcbn0pO1xuXG4vKipcbiAqIEFic3RyYWN0aW9uIGZvciBhIHBhcnRpYWxseS1jb21waWxlZCBmcmFnbWVudC5cbiAqIENhbiBvcHRpb25hbGx5IGNvbXBpbGUgY29udGVudCB3aXRoIGEgY2hpbGQgc2NvcGUuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gbGlua2VyXG4gKiBAcGFyYW0ge1Z1ZX0gdm1cbiAqIEBwYXJhbSB7RG9jdW1lbnRGcmFnbWVudH0gZnJhZ1xuICogQHBhcmFtIHtWdWV9IFtob3N0XVxuICogQHBhcmFtIHtPYmplY3R9IFtzY29wZV1cbiAqL1xuZnVuY3Rpb24gRnJhZ21lbnQobGlua2VyLCB2bSwgZnJhZywgaG9zdCwgc2NvcGUsIHBhcmVudEZyYWcpIHtcbiAgdGhpcy5jaGlsZHJlbiA9IFtdO1xuICB0aGlzLmNoaWxkRnJhZ3MgPSBbXTtcbiAgdGhpcy52bSA9IHZtO1xuICB0aGlzLnNjb3BlID0gc2NvcGU7XG4gIHRoaXMuaW5zZXJ0ZWQgPSBmYWxzZTtcbiAgdGhpcy5wYXJlbnRGcmFnID0gcGFyZW50RnJhZztcbiAgaWYgKHBhcmVudEZyYWcpIHtcbiAgICBwYXJlbnRGcmFnLmNoaWxkRnJhZ3MucHVzaCh0aGlzKTtcbiAgfVxuICB0aGlzLnVubGluayA9IGxpbmtlcih2bSwgZnJhZywgaG9zdCwgc2NvcGUsIHRoaXMpO1xuICB2YXIgc2luZ2xlID0gdGhpcy5zaW5nbGUgPSBmcmFnLmNoaWxkTm9kZXMubGVuZ3RoID09PSAxICYmXG4gIC8vIGRvIG5vdCBnbyBzaW5nbGUgbW9kZSBpZiB0aGUgb25seSBub2RlIGlzIGFuIGFuY2hvclxuICAhZnJhZy5jaGlsZE5vZGVzWzBdLl9fdnVlX2FuY2hvcjtcbiAgaWYgKHNpbmdsZSkge1xuICAgIHRoaXMubm9kZSA9IGZyYWcuY2hpbGROb2Rlc1swXTtcbiAgICB0aGlzLmJlZm9yZSA9IHNpbmdsZUJlZm9yZTtcbiAgICB0aGlzLnJlbW92ZSA9IHNpbmdsZVJlbW92ZTtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLm5vZGUgPSBjcmVhdGVBbmNob3IoJ2ZyYWdtZW50LXN0YXJ0Jyk7XG4gICAgdGhpcy5lbmQgPSBjcmVhdGVBbmNob3IoJ2ZyYWdtZW50LWVuZCcpO1xuICAgIHRoaXMuZnJhZyA9IGZyYWc7XG4gICAgcHJlcGVuZCh0aGlzLm5vZGUsIGZyYWcpO1xuICAgIGZyYWcuYXBwZW5kQ2hpbGQodGhpcy5lbmQpO1xuICAgIHRoaXMuYmVmb3JlID0gbXVsdGlCZWZvcmU7XG4gICAgdGhpcy5yZW1vdmUgPSBtdWx0aVJlbW92ZTtcbiAgfVxuICB0aGlzLm5vZGUuX192ZnJhZ19fID0gdGhpcztcbn1cblxuLyoqXG4gKiBDYWxsIGF0dGFjaC9kZXRhY2ggZm9yIGFsbCBjb21wb25lbnRzIGNvbnRhaW5lZCB3aXRoaW5cbiAqIHRoaXMgZnJhZ21lbnQuIEFsc28gZG8gc28gcmVjdXJzaXZlbHkgZm9yIGFsbCBjaGlsZFxuICogZnJhZ21lbnRzLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGhvb2tcbiAqL1xuXG5GcmFnbWVudC5wcm90b3R5cGUuY2FsbEhvb2sgPSBmdW5jdGlvbiAoaG9vaykge1xuICB2YXIgaSwgbDtcbiAgZm9yIChpID0gMCwgbCA9IHRoaXMuY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgaG9vayh0aGlzLmNoaWxkcmVuW2ldKTtcbiAgfVxuICBmb3IgKGkgPSAwLCBsID0gdGhpcy5jaGlsZEZyYWdzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIHRoaXMuY2hpbGRGcmFnc1tpXS5jYWxsSG9vayhob29rKTtcbiAgfVxufTtcblxuLyoqXG4gKiBEZXN0cm95IHRoZSBmcmFnbWVudC5cbiAqL1xuXG5GcmFnbWVudC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHRoaXMucGFyZW50RnJhZykge1xuICAgIHRoaXMucGFyZW50RnJhZy5jaGlsZEZyYWdzLiRyZW1vdmUodGhpcyk7XG4gIH1cbiAgdGhpcy51bmxpbmsoKTtcbn07XG5cbi8qKlxuICogSW5zZXJ0IGZyYWdtZW50IGJlZm9yZSB0YXJnZXQsIHNpbmdsZSBub2RlIHZlcnNpb25cbiAqXG4gKiBAcGFyYW0ge05vZGV9IHRhcmdldFxuICogQHBhcmFtIHtCb29sZWFufSB3aXRoVHJhbnNpdGlvblxuICovXG5cbmZ1bmN0aW9uIHNpbmdsZUJlZm9yZSh0YXJnZXQsIHdpdGhUcmFuc2l0aW9uKSB7XG4gIHRoaXMuaW5zZXJ0ZWQgPSB0cnVlO1xuICB2YXIgbWV0aG9kID0gd2l0aFRyYW5zaXRpb24gIT09IGZhbHNlID8gYmVmb3JlV2l0aFRyYW5zaXRpb24gOiBiZWZvcmU7XG4gIG1ldGhvZCh0aGlzLm5vZGUsIHRhcmdldCwgdGhpcy52bSk7XG4gIGlmIChpbkRvYyh0aGlzLm5vZGUpKSB7XG4gICAgdGhpcy5jYWxsSG9vayhhdHRhY2gpO1xuICB9XG59XG5cbi8qKlxuICogUmVtb3ZlIGZyYWdtZW50LCBzaW5nbGUgbm9kZSB2ZXJzaW9uXG4gKi9cblxuZnVuY3Rpb24gc2luZ2xlUmVtb3ZlKCkge1xuICB0aGlzLmluc2VydGVkID0gZmFsc2U7XG4gIHZhciBzaG91bGRDYWxsUmVtb3ZlID0gaW5Eb2ModGhpcy5ub2RlKTtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzZWxmLmNhbGxIb29rKGRlc3Ryb3lDaGlsZCk7XG4gIHJlbW92ZVdpdGhUcmFuc2l0aW9uKHRoaXMubm9kZSwgdGhpcy52bSwgZnVuY3Rpb24gKCkge1xuICAgIGlmIChzaG91bGRDYWxsUmVtb3ZlKSB7XG4gICAgICBzZWxmLmNhbGxIb29rKGRldGFjaCk7XG4gICAgfVxuICAgIHNlbGYuZGVzdHJveSgpO1xuICB9KTtcbn1cblxuLyoqXG4gKiBJbnNlcnQgZnJhZ21lbnQgYmVmb3JlIHRhcmdldCwgbXVsdGktbm9kZXMgdmVyc2lvblxuICpcbiAqIEBwYXJhbSB7Tm9kZX0gdGFyZ2V0XG4gKiBAcGFyYW0ge0Jvb2xlYW59IHdpdGhUcmFuc2l0aW9uXG4gKi9cblxuZnVuY3Rpb24gbXVsdGlCZWZvcmUodGFyZ2V0LCB3aXRoVHJhbnNpdGlvbikge1xuICB0aGlzLmluc2VydGVkID0gdHJ1ZTtcbiAgdmFyIHZtID0gdGhpcy52bTtcbiAgdmFyIG1ldGhvZCA9IHdpdGhUcmFuc2l0aW9uICE9PSBmYWxzZSA/IGJlZm9yZVdpdGhUcmFuc2l0aW9uIDogYmVmb3JlO1xuICBtYXBOb2RlUmFuZ2UodGhpcy5ub2RlLCB0aGlzLmVuZCwgZnVuY3Rpb24gKG5vZGUpIHtcbiAgICBtZXRob2Qobm9kZSwgdGFyZ2V0LCB2bSk7XG4gIH0pO1xuICBpZiAoaW5Eb2ModGhpcy5ub2RlKSkge1xuICAgIHRoaXMuY2FsbEhvb2soYXR0YWNoKTtcbiAgfVxufVxuXG4vKipcbiAqIFJlbW92ZSBmcmFnbWVudCwgbXVsdGktbm9kZXMgdmVyc2lvblxuICovXG5cbmZ1bmN0aW9uIG11bHRpUmVtb3ZlKCkge1xuICB0aGlzLmluc2VydGVkID0gZmFsc2U7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIHNob3VsZENhbGxSZW1vdmUgPSBpbkRvYyh0aGlzLm5vZGUpO1xuICBzZWxmLmNhbGxIb29rKGRlc3Ryb3lDaGlsZCk7XG4gIHJlbW92ZU5vZGVSYW5nZSh0aGlzLm5vZGUsIHRoaXMuZW5kLCB0aGlzLnZtLCB0aGlzLmZyYWcsIGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoc2hvdWxkQ2FsbFJlbW92ZSkge1xuICAgICAgc2VsZi5jYWxsSG9vayhkZXRhY2gpO1xuICAgIH1cbiAgICBzZWxmLmRlc3Ryb3koKTtcbiAgfSk7XG59XG5cbi8qKlxuICogQ2FsbCBhdHRhY2ggaG9vayBmb3IgYSBWdWUgaW5zdGFuY2UuXG4gKlxuICogQHBhcmFtIHtWdWV9IGNoaWxkXG4gKi9cblxuZnVuY3Rpb24gYXR0YWNoKGNoaWxkKSB7XG4gIGlmICghY2hpbGQuX2lzQXR0YWNoZWQpIHtcbiAgICBjaGlsZC5fY2FsbEhvb2soJ2F0dGFjaGVkJyk7XG4gIH1cbn1cblxuLyoqXG4gKiBDYWxsIGRlc3Ryb3kgZm9yIGFsbCBjb250YWluZWQgaW5zdGFuY2VzLFxuICogd2l0aCByZW1vdmU6ZmFsc2UgYW5kIGRlZmVyOnRydWUuXG4gKiBEZWZlciBpcyBuZWNlc3NhcnkgYmVjYXVzZSB3ZSBuZWVkIHRvXG4gKiBrZWVwIHRoZSBjaGlsZHJlbiB0byBjYWxsIGRldGFjaCBob29rc1xuICogb24gdGhlbS5cbiAqXG4gKiBAcGFyYW0ge1Z1ZX0gY2hpbGRcbiAqL1xuXG5mdW5jdGlvbiBkZXN0cm95Q2hpbGQoY2hpbGQpIHtcbiAgY2hpbGQuJGRlc3Ryb3koZmFsc2UsIHRydWUpO1xufVxuXG4vKipcbiAqIENhbGwgZGV0YWNoIGhvb2sgZm9yIGEgVnVlIGluc3RhbmNlLlxuICpcbiAqIEBwYXJhbSB7VnVlfSBjaGlsZFxuICovXG5cbmZ1bmN0aW9uIGRldGFjaChjaGlsZCkge1xuICBpZiAoY2hpbGQuX2lzQXR0YWNoZWQpIHtcbiAgICBjaGlsZC5fY2FsbEhvb2soJ2RldGFjaGVkJyk7XG4gIH1cbn1cblxudmFyIGxpbmtlckNhY2hlID0gbmV3IENhY2hlKDUwMDApO1xuXG4vKipcbiAqIEEgZmFjdG9yeSB0aGF0IGNhbiBiZSB1c2VkIHRvIGNyZWF0ZSBpbnN0YW5jZXMgb2YgYVxuICogZnJhZ21lbnQuIENhY2hlcyB0aGUgY29tcGlsZWQgbGlua2VyIGlmIHBvc3NpYmxlLlxuICpcbiAqIEBwYXJhbSB7VnVlfSB2bVxuICogQHBhcmFtIHtFbGVtZW50fFN0cmluZ30gZWxcbiAqL1xuZnVuY3Rpb24gRnJhZ21lbnRGYWN0b3J5KHZtLCBlbCkge1xuICB0aGlzLnZtID0gdm07XG4gIHZhciB0ZW1wbGF0ZTtcbiAgdmFyIGlzU3RyaW5nID0gdHlwZW9mIGVsID09PSAnc3RyaW5nJztcbiAgaWYgKGlzU3RyaW5nIHx8IGlzVGVtcGxhdGUoZWwpKSB7XG4gICAgdGVtcGxhdGUgPSBwYXJzZVRlbXBsYXRlKGVsLCB0cnVlKTtcbiAgfSBlbHNlIHtcbiAgICB0ZW1wbGF0ZSA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgICB0ZW1wbGF0ZS5hcHBlbmRDaGlsZChlbCk7XG4gIH1cbiAgdGhpcy50ZW1wbGF0ZSA9IHRlbXBsYXRlO1xuICAvLyBsaW5rZXIgY2FuIGJlIGNhY2hlZCwgYnV0IG9ubHkgZm9yIGNvbXBvbmVudHNcbiAgdmFyIGxpbmtlcjtcbiAgdmFyIGNpZCA9IHZtLmNvbnN0cnVjdG9yLmNpZDtcbiAgaWYgKGNpZCA+IDApIHtcbiAgICB2YXIgY2FjaGVJZCA9IGNpZCArIChpc1N0cmluZyA/IGVsIDogZWwub3V0ZXJIVE1MKTtcbiAgICBsaW5rZXIgPSBsaW5rZXJDYWNoZS5nZXQoY2FjaGVJZCk7XG4gICAgaWYgKCFsaW5rZXIpIHtcbiAgICAgIGxpbmtlciA9IGNvbXBpbGUodGVtcGxhdGUsIHZtLiRvcHRpb25zLCB0cnVlKTtcbiAgICAgIGxpbmtlckNhY2hlLnB1dChjYWNoZUlkLCBsaW5rZXIpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBsaW5rZXIgPSBjb21waWxlKHRlbXBsYXRlLCB2bS4kb3B0aW9ucywgdHJ1ZSk7XG4gIH1cbiAgdGhpcy5saW5rZXIgPSBsaW5rZXI7XG59XG5cbi8qKlxuICogQ3JlYXRlIGEgZnJhZ21lbnQgaW5zdGFuY2Ugd2l0aCBnaXZlbiBob3N0IGFuZCBzY29wZS5cbiAqXG4gKiBAcGFyYW0ge1Z1ZX0gaG9zdFxuICogQHBhcmFtIHtPYmplY3R9IHNjb3BlXG4gKiBAcGFyYW0ge0ZyYWdtZW50fSBwYXJlbnRGcmFnXG4gKi9cblxuRnJhZ21lbnRGYWN0b3J5LnByb3RvdHlwZS5jcmVhdGUgPSBmdW5jdGlvbiAoaG9zdCwgc2NvcGUsIHBhcmVudEZyYWcpIHtcbiAgdmFyIGZyYWcgPSBjbG9uZU5vZGUodGhpcy50ZW1wbGF0ZSk7XG4gIHJldHVybiBuZXcgRnJhZ21lbnQodGhpcy5saW5rZXIsIHRoaXMudm0sIGZyYWcsIGhvc3QsIHNjb3BlLCBwYXJlbnRGcmFnKTtcbn07XG5cbnZhciB2SWYgPSB7XG5cbiAgcHJpb3JpdHk6IElGLFxuXG4gIGJpbmQ6IGZ1bmN0aW9uIGJpbmQoKSB7XG4gICAgdmFyIGVsID0gdGhpcy5lbDtcbiAgICBpZiAoIWVsLl9fdnVlX18pIHtcbiAgICAgIC8vIGNoZWNrIGVsc2UgYmxvY2tcbiAgICAgIHZhciBuZXh0ID0gZWwubmV4dEVsZW1lbnRTaWJsaW5nO1xuICAgICAgaWYgKG5leHQgJiYgZ2V0QXR0cihuZXh0LCAndi1lbHNlJykgIT09IG51bGwpIHtcbiAgICAgICAgcmVtb3ZlKG5leHQpO1xuICAgICAgICB0aGlzLmVsc2VGYWN0b3J5ID0gbmV3IEZyYWdtZW50RmFjdG9yeSh0aGlzLnZtLCBuZXh0KTtcbiAgICAgIH1cbiAgICAgIC8vIGNoZWNrIG1haW4gYmxvY2tcbiAgICAgIHRoaXMuYW5jaG9yID0gY3JlYXRlQW5jaG9yKCd2LWlmJyk7XG4gICAgICByZXBsYWNlKGVsLCB0aGlzLmFuY2hvcik7XG4gICAgICB0aGlzLmZhY3RvcnkgPSBuZXcgRnJhZ21lbnRGYWN0b3J5KHRoaXMudm0sIGVsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB3YXJuKCd2LWlmPVwiJyArIHRoaXMuZXhwcmVzc2lvbiArICdcIiBjYW5ub3QgYmUgJyArICd1c2VkIG9uIGFuIGluc3RhbmNlIHJvb3QgZWxlbWVudC4nKTtcbiAgICAgIHRoaXMuaW52YWxpZCA9IHRydWU7XG4gICAgfVxuICB9LFxuXG4gIHVwZGF0ZTogZnVuY3Rpb24gdXBkYXRlKHZhbHVlKSB7XG4gICAgaWYgKHRoaXMuaW52YWxpZCkgcmV0dXJuO1xuICAgIGlmICh2YWx1ZSkge1xuICAgICAgaWYgKCF0aGlzLmZyYWcpIHtcbiAgICAgICAgdGhpcy5pbnNlcnQoKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5yZW1vdmUoKTtcbiAgICB9XG4gIH0sXG5cbiAgaW5zZXJ0OiBmdW5jdGlvbiBpbnNlcnQoKSB7XG4gICAgaWYgKHRoaXMuZWxzZUZyYWcpIHtcbiAgICAgIHRoaXMuZWxzZUZyYWcucmVtb3ZlKCk7XG4gICAgICB0aGlzLmVsc2VGcmFnID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5mcmFnID0gdGhpcy5mYWN0b3J5LmNyZWF0ZSh0aGlzLl9ob3N0LCB0aGlzLl9zY29wZSwgdGhpcy5fZnJhZyk7XG4gICAgdGhpcy5mcmFnLmJlZm9yZSh0aGlzLmFuY2hvcik7XG4gIH0sXG5cbiAgcmVtb3ZlOiBmdW5jdGlvbiByZW1vdmUoKSB7XG4gICAgaWYgKHRoaXMuZnJhZykge1xuICAgICAgdGhpcy5mcmFnLnJlbW92ZSgpO1xuICAgICAgdGhpcy5mcmFnID0gbnVsbDtcbiAgICB9XG4gICAgaWYgKHRoaXMuZWxzZUZhY3RvcnkgJiYgIXRoaXMuZWxzZUZyYWcpIHtcbiAgICAgIHRoaXMuZWxzZUZyYWcgPSB0aGlzLmVsc2VGYWN0b3J5LmNyZWF0ZSh0aGlzLl9ob3N0LCB0aGlzLl9zY29wZSwgdGhpcy5fZnJhZyk7XG4gICAgICB0aGlzLmVsc2VGcmFnLmJlZm9yZSh0aGlzLmFuY2hvcik7XG4gICAgfVxuICB9LFxuXG4gIHVuYmluZDogZnVuY3Rpb24gdW5iaW5kKCkge1xuICAgIGlmICh0aGlzLmZyYWcpIHtcbiAgICAgIHRoaXMuZnJhZy5kZXN0cm95KCk7XG4gICAgfVxuICB9XG59O1xuXG52YXIgdWlkJDEgPSAwO1xuXG52YXIgdkZvciA9IHtcblxuICBwcmlvcml0eTogRk9SLFxuXG4gIHBhcmFtczogWyd0cmFjay1ieScsICdzdGFnZ2VyJywgJ2VudGVyLXN0YWdnZXInLCAnbGVhdmUtc3RhZ2dlciddLFxuXG4gIGJpbmQ6IGZ1bmN0aW9uIGJpbmQoKSB7XG4gICAgLy8gc3VwcG9ydCBcIml0ZW0gaW4gaXRlbXNcIiBzeW50YXhcbiAgICB2YXIgaW5NYXRjaCA9IHRoaXMuZXhwcmVzc2lvbi5tYXRjaCgvKC4qKSBpbiAoLiopLyk7XG4gICAgaWYgKGluTWF0Y2gpIHtcbiAgICAgIHZhciBpdE1hdGNoID0gaW5NYXRjaFsxXS5tYXRjaCgvXFwoKC4qKSwoLiopXFwpLyk7XG4gICAgICBpZiAoaXRNYXRjaCkge1xuICAgICAgICB0aGlzLml0ZXJhdG9yID0gaXRNYXRjaFsxXS50cmltKCk7XG4gICAgICAgIHRoaXMuYWxpYXMgPSBpdE1hdGNoWzJdLnRyaW0oKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuYWxpYXMgPSBpbk1hdGNoWzFdLnRyaW0oKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZXhwcmVzc2lvbiA9IGluTWF0Y2hbMl07XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLmFsaWFzKSB7XG4gICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHdhcm4oJ0FsaWFzIGlzIHJlcXVpcmVkIGluIHYtZm9yLicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIHVpZCBhcyBhIGNhY2hlIGlkZW50aWZpZXJcbiAgICB0aGlzLmlkID0gJ19fdi1mb3JfXycgKyArK3VpZCQxO1xuXG4gICAgLy8gY2hlY2sgaWYgdGhpcyBpcyBhbiBvcHRpb24gbGlzdCxcbiAgICAvLyBzbyB0aGF0IHdlIGtub3cgaWYgd2UgbmVlZCB0byB1cGRhdGUgdGhlIDxzZWxlY3Q+J3NcbiAgICAvLyB2LW1vZGVsIHdoZW4gdGhlIG9wdGlvbiBsaXN0IGhhcyBjaGFuZ2VkLlxuICAgIC8vIGJlY2F1c2Ugdi1tb2RlbCBoYXMgYSBsb3dlciBwcmlvcml0eSB0aGFuIHYtZm9yLFxuICAgIC8vIHRoZSB2LW1vZGVsIGlzIG5vdCBib3VuZCBoZXJlIHlldCwgc28gd2UgaGF2ZSB0b1xuICAgIC8vIHJldHJpdmUgaXQgaW4gdGhlIGFjdHVhbCB1cGRhdGVNb2RlbCgpIGZ1bmN0aW9uLlxuICAgIHZhciB0YWcgPSB0aGlzLmVsLnRhZ05hbWU7XG4gICAgdGhpcy5pc09wdGlvbiA9ICh0YWcgPT09ICdPUFRJT04nIHx8IHRhZyA9PT0gJ09QVEdST1VQJykgJiYgdGhpcy5lbC5wYXJlbnROb2RlLnRhZ05hbWUgPT09ICdTRUxFQ1QnO1xuXG4gICAgLy8gc2V0dXAgYW5jaG9yIG5vZGVzXG4gICAgdGhpcy5zdGFydCA9IGNyZWF0ZUFuY2hvcigndi1mb3Itc3RhcnQnKTtcbiAgICB0aGlzLmVuZCA9IGNyZWF0ZUFuY2hvcigndi1mb3ItZW5kJyk7XG4gICAgcmVwbGFjZSh0aGlzLmVsLCB0aGlzLmVuZCk7XG4gICAgYmVmb3JlKHRoaXMuc3RhcnQsIHRoaXMuZW5kKTtcblxuICAgIC8vIGNhY2hlXG4gICAgdGhpcy5jYWNoZSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgICAvLyBmcmFnbWVudCBmYWN0b3J5XG4gICAgdGhpcy5mYWN0b3J5ID0gbmV3IEZyYWdtZW50RmFjdG9yeSh0aGlzLnZtLCB0aGlzLmVsKTtcbiAgfSxcblxuICB1cGRhdGU6IGZ1bmN0aW9uIHVwZGF0ZShkYXRhKSB7XG4gICAgdGhpcy5kaWZmKGRhdGEpO1xuICAgIHRoaXMudXBkYXRlUmVmKCk7XG4gICAgdGhpcy51cGRhdGVNb2RlbCgpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBEaWZmLCBiYXNlZCBvbiBuZXcgZGF0YSBhbmQgb2xkIGRhdGEsIGRldGVybWluZSB0aGVcbiAgICogbWluaW11bSBhbW91bnQgb2YgRE9NIG1hbmlwdWxhdGlvbnMgbmVlZGVkIHRvIG1ha2UgdGhlXG4gICAqIERPTSByZWZsZWN0IHRoZSBuZXcgZGF0YSBBcnJheS5cbiAgICpcbiAgICogVGhlIGFsZ29yaXRobSBkaWZmcyB0aGUgbmV3IGRhdGEgQXJyYXkgYnkgc3RvcmluZyBhXG4gICAqIGhpZGRlbiByZWZlcmVuY2UgdG8gYW4gb3duZXIgdm0gaW5zdGFuY2Ugb24gcHJldmlvdXNseVxuICAgKiBzZWVuIGRhdGEuIFRoaXMgYWxsb3dzIHVzIHRvIGFjaGlldmUgTyhuKSB3aGljaCBpc1xuICAgKiBiZXR0ZXIgdGhhbiBhIGxldmVuc2h0ZWluIGRpc3RhbmNlIGJhc2VkIGFsZ29yaXRobSxcbiAgICogd2hpY2ggaXMgTyhtICogbikuXG4gICAqXG4gICAqIEBwYXJhbSB7QXJyYXl9IGRhdGFcbiAgICovXG5cbiAgZGlmZjogZnVuY3Rpb24gZGlmZihkYXRhKSB7XG4gICAgLy8gY2hlY2sgaWYgdGhlIEFycmF5IHdhcyBjb252ZXJ0ZWQgZnJvbSBhbiBPYmplY3RcbiAgICB2YXIgaXRlbSA9IGRhdGFbMF07XG4gICAgdmFyIGNvbnZlcnRlZEZyb21PYmplY3QgPSB0aGlzLmZyb21PYmplY3QgPSBpc09iamVjdChpdGVtKSAmJiBoYXNPd24oaXRlbSwgJyRrZXknKSAmJiBoYXNPd24oaXRlbSwgJyR2YWx1ZScpO1xuXG4gICAgdmFyIHRyYWNrQnlLZXkgPSB0aGlzLnBhcmFtcy50cmFja0J5O1xuICAgIHZhciBvbGRGcmFncyA9IHRoaXMuZnJhZ3M7XG4gICAgdmFyIGZyYWdzID0gdGhpcy5mcmFncyA9IG5ldyBBcnJheShkYXRhLmxlbmd0aCk7XG4gICAgdmFyIGFsaWFzID0gdGhpcy5hbGlhcztcbiAgICB2YXIgaXRlcmF0b3IgPSB0aGlzLml0ZXJhdG9yO1xuICAgIHZhciBzdGFydCA9IHRoaXMuc3RhcnQ7XG4gICAgdmFyIGVuZCA9IHRoaXMuZW5kO1xuICAgIHZhciBpbkRvY3VtZW50ID0gaW5Eb2Moc3RhcnQpO1xuICAgIHZhciBpbml0ID0gIW9sZEZyYWdzO1xuICAgIHZhciBpLCBsLCBmcmFnLCBrZXksIHZhbHVlLCBwcmltaXRpdmU7XG5cbiAgICAvLyBGaXJzdCBwYXNzLCBnbyB0aHJvdWdoIHRoZSBuZXcgQXJyYXkgYW5kIGZpbGwgdXBcbiAgICAvLyB0aGUgbmV3IGZyYWdzIGFycmF5LiBJZiBhIHBpZWNlIG9mIGRhdGEgaGFzIGEgY2FjaGVkXG4gICAgLy8gaW5zdGFuY2UgZm9yIGl0LCB3ZSByZXVzZSBpdC4gT3RoZXJ3aXNlIGJ1aWxkIGEgbmV3XG4gICAgLy8gaW5zdGFuY2UuXG4gICAgZm9yIChpID0gMCwgbCA9IGRhdGEubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICBpdGVtID0gZGF0YVtpXTtcbiAgICAgIGtleSA9IGNvbnZlcnRlZEZyb21PYmplY3QgPyBpdGVtLiRrZXkgOiBudWxsO1xuICAgICAgdmFsdWUgPSBjb252ZXJ0ZWRGcm9tT2JqZWN0ID8gaXRlbS4kdmFsdWUgOiBpdGVtO1xuICAgICAgcHJpbWl0aXZlID0gIWlzT2JqZWN0KHZhbHVlKTtcbiAgICAgIGZyYWcgPSAhaW5pdCAmJiB0aGlzLmdldENhY2hlZEZyYWcodmFsdWUsIGksIGtleSk7XG4gICAgICBpZiAoZnJhZykge1xuICAgICAgICAvLyByZXVzYWJsZSBmcmFnbWVudFxuICAgICAgICBmcmFnLnJldXNlZCA9IHRydWU7XG4gICAgICAgIC8vIHVwZGF0ZSAkaW5kZXhcbiAgICAgICAgZnJhZy5zY29wZS4kaW5kZXggPSBpO1xuICAgICAgICAvLyB1cGRhdGUgJGtleVxuICAgICAgICBpZiAoa2V5KSB7XG4gICAgICAgICAgZnJhZy5zY29wZS4ka2V5ID0ga2V5O1xuICAgICAgICB9XG4gICAgICAgIC8vIHVwZGF0ZSBpdGVyYXRvclxuICAgICAgICBpZiAoaXRlcmF0b3IpIHtcbiAgICAgICAgICBmcmFnLnNjb3BlW2l0ZXJhdG9yXSA9IGtleSAhPT0gbnVsbCA/IGtleSA6IGk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gdXBkYXRlIGRhdGEgZm9yIHRyYWNrLWJ5LCBvYmplY3QgcmVwZWF0ICZcbiAgICAgICAgLy8gcHJpbWl0aXZlIHZhbHVlcy5cbiAgICAgICAgaWYgKHRyYWNrQnlLZXkgfHwgY29udmVydGVkRnJvbU9iamVjdCB8fCBwcmltaXRpdmUpIHtcbiAgICAgICAgICBmcmFnLnNjb3BlW2FsaWFzXSA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBuZXcgaXNudGFuY2VcbiAgICAgICAgZnJhZyA9IHRoaXMuY3JlYXRlKHZhbHVlLCBhbGlhcywgaSwga2V5KTtcbiAgICAgICAgZnJhZy5mcmVzaCA9ICFpbml0O1xuICAgICAgfVxuICAgICAgZnJhZ3NbaV0gPSBmcmFnO1xuICAgICAgaWYgKGluaXQpIHtcbiAgICAgICAgZnJhZy5iZWZvcmUoZW5kKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyB3ZSdyZSBkb25lIGZvciB0aGUgaW5pdGlhbCByZW5kZXIuXG4gICAgaWYgKGluaXQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBTZWNvbmQgcGFzcywgZ28gdGhyb3VnaCB0aGUgb2xkIGZyYWdtZW50cyBhbmRcbiAgICAvLyBkZXN0cm95IHRob3NlIHdobyBhcmUgbm90IHJldXNlZCAoYW5kIHJlbW92ZSB0aGVtXG4gICAgLy8gZnJvbSBjYWNoZSlcbiAgICB2YXIgcmVtb3ZhbEluZGV4ID0gMDtcbiAgICB2YXIgdG90YWxSZW1vdmVkID0gb2xkRnJhZ3MubGVuZ3RoIC0gZnJhZ3MubGVuZ3RoO1xuICAgIGZvciAoaSA9IDAsIGwgPSBvbGRGcmFncy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIGZyYWcgPSBvbGRGcmFnc1tpXTtcbiAgICAgIGlmICghZnJhZy5yZXVzZWQpIHtcbiAgICAgICAgdGhpcy5kZWxldGVDYWNoZWRGcmFnKGZyYWcpO1xuICAgICAgICB0aGlzLnJlbW92ZShmcmFnLCByZW1vdmFsSW5kZXgrKywgdG90YWxSZW1vdmVkLCBpbkRvY3VtZW50KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBGaW5hbCBwYXNzLCBtb3ZlL2luc2VydCBuZXcgZnJhZ21lbnRzIGludG8gdGhlXG4gICAgLy8gcmlnaHQgcGxhY2UuXG4gICAgdmFyIHRhcmdldFByZXYsIHByZXZFbCwgY3VycmVudFByZXY7XG4gICAgdmFyIGluc2VydGlvbkluZGV4ID0gMDtcbiAgICBmb3IgKGkgPSAwLCBsID0gZnJhZ3MubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICBmcmFnID0gZnJhZ3NbaV07XG4gICAgICAvLyB0aGlzIGlzIHRoZSBmcmFnIHRoYXQgd2Ugc2hvdWxkIGJlIGFmdGVyXG4gICAgICB0YXJnZXRQcmV2ID0gZnJhZ3NbaSAtIDFdO1xuICAgICAgcHJldkVsID0gdGFyZ2V0UHJldiA/IHRhcmdldFByZXYuc3RhZ2dlckNiID8gdGFyZ2V0UHJldi5zdGFnZ2VyQW5jaG9yIDogdGFyZ2V0UHJldi5lbmQgfHwgdGFyZ2V0UHJldi5ub2RlIDogc3RhcnQ7XG4gICAgICBpZiAoZnJhZy5yZXVzZWQgJiYgIWZyYWcuc3RhZ2dlckNiKSB7XG4gICAgICAgIGN1cnJlbnRQcmV2ID0gZmluZFByZXZGcmFnKGZyYWcsIHN0YXJ0LCB0aGlzLmlkKTtcbiAgICAgICAgaWYgKGN1cnJlbnRQcmV2ICE9PSB0YXJnZXRQcmV2ICYmICghY3VycmVudFByZXYgfHxcbiAgICAgICAgLy8gb3B0aW1pemF0aW9uIGZvciBtb3ZpbmcgYSBzaW5nbGUgaXRlbS5cbiAgICAgICAgLy8gdGhhbmtzIHRvIHN1Z2dlc3Rpb25zIGJ5IEBsaXZvcmFzIGluICMxODA3XG4gICAgICAgIGZpbmRQcmV2RnJhZyhjdXJyZW50UHJldiwgc3RhcnQsIHRoaXMuaWQpICE9PSB0YXJnZXRQcmV2KSkge1xuICAgICAgICAgIHRoaXMubW92ZShmcmFnLCBwcmV2RWwpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBuZXcgaW5zdGFuY2UsIG9yIHN0aWxsIGluIHN0YWdnZXIuXG4gICAgICAgIC8vIGluc2VydCB3aXRoIHVwZGF0ZWQgc3RhZ2dlciBpbmRleC5cbiAgICAgICAgdGhpcy5pbnNlcnQoZnJhZywgaW5zZXJ0aW9uSW5kZXgrKywgcHJldkVsLCBpbkRvY3VtZW50KTtcbiAgICAgIH1cbiAgICAgIGZyYWcucmV1c2VkID0gZnJhZy5mcmVzaCA9IGZhbHNlO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IGZyYWdtZW50IGluc3RhbmNlLlxuICAgKlxuICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBhbGlhc1xuICAgKiBAcGFyYW0ge051bWJlcn0gaW5kZXhcbiAgICogQHBhcmFtIHtTdHJpbmd9IFtrZXldXG4gICAqIEByZXR1cm4ge0ZyYWdtZW50fVxuICAgKi9cblxuICBjcmVhdGU6IGZ1bmN0aW9uIGNyZWF0ZSh2YWx1ZSwgYWxpYXMsIGluZGV4LCBrZXkpIHtcbiAgICB2YXIgaG9zdCA9IHRoaXMuX2hvc3Q7XG4gICAgLy8gY3JlYXRlIGl0ZXJhdGlvbiBzY29wZVxuICAgIHZhciBwYXJlbnRTY29wZSA9IHRoaXMuX3Njb3BlIHx8IHRoaXMudm07XG4gICAgdmFyIHNjb3BlID0gT2JqZWN0LmNyZWF0ZShwYXJlbnRTY29wZSk7XG4gICAgLy8gcmVmIGhvbGRlciBmb3IgdGhlIHNjb3BlXG4gICAgc2NvcGUuJHJlZnMgPSBPYmplY3QuY3JlYXRlKHBhcmVudFNjb3BlLiRyZWZzKTtcbiAgICBzY29wZS4kZWxzID0gT2JqZWN0LmNyZWF0ZShwYXJlbnRTY29wZS4kZWxzKTtcbiAgICAvLyBtYWtlIHN1cmUgcG9pbnQgJHBhcmVudCB0byBwYXJlbnQgc2NvcGVcbiAgICBzY29wZS4kcGFyZW50ID0gcGFyZW50U2NvcGU7XG4gICAgLy8gZm9yIHR3by13YXkgYmluZGluZyBvbiBhbGlhc1xuICAgIHNjb3BlLiRmb3JDb250ZXh0ID0gdGhpcztcbiAgICAvLyBkZWZpbmUgc2NvcGUgcHJvcGVydGllc1xuICAgIGRlZmluZVJlYWN0aXZlKHNjb3BlLCBhbGlhcywgdmFsdWUpO1xuICAgIGRlZmluZVJlYWN0aXZlKHNjb3BlLCAnJGluZGV4JywgaW5kZXgpO1xuICAgIGlmIChrZXkpIHtcbiAgICAgIGRlZmluZVJlYWN0aXZlKHNjb3BlLCAnJGtleScsIGtleSk7XG4gICAgfSBlbHNlIGlmIChzY29wZS4ka2V5KSB7XG4gICAgICAvLyBhdm9pZCBhY2NpZGVudGFsIGZhbGxiYWNrXG4gICAgICBkZWYoc2NvcGUsICcka2V5JywgbnVsbCk7XG4gICAgfVxuICAgIGlmICh0aGlzLml0ZXJhdG9yKSB7XG4gICAgICBkZWZpbmVSZWFjdGl2ZShzY29wZSwgdGhpcy5pdGVyYXRvciwga2V5ICE9PSBudWxsID8ga2V5IDogaW5kZXgpO1xuICAgIH1cbiAgICB2YXIgZnJhZyA9IHRoaXMuZmFjdG9yeS5jcmVhdGUoaG9zdCwgc2NvcGUsIHRoaXMuX2ZyYWcpO1xuICAgIGZyYWcuZm9ySWQgPSB0aGlzLmlkO1xuICAgIHRoaXMuY2FjaGVGcmFnKHZhbHVlLCBmcmFnLCBpbmRleCwga2V5KTtcbiAgICByZXR1cm4gZnJhZztcbiAgfSxcblxuICAvKipcbiAgICogVXBkYXRlIHRoZSB2LXJlZiBvbiBvd25lciB2bS5cbiAgICovXG5cbiAgdXBkYXRlUmVmOiBmdW5jdGlvbiB1cGRhdGVSZWYoKSB7XG4gICAgdmFyIHJlZiA9IHRoaXMuZGVzY3JpcHRvci5yZWY7XG4gICAgaWYgKCFyZWYpIHJldHVybjtcbiAgICB2YXIgaGFzaCA9ICh0aGlzLl9zY29wZSB8fCB0aGlzLnZtKS4kcmVmcztcbiAgICB2YXIgcmVmcztcbiAgICBpZiAoIXRoaXMuZnJvbU9iamVjdCkge1xuICAgICAgcmVmcyA9IHRoaXMuZnJhZ3MubWFwKGZpbmRWbUZyb21GcmFnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVmcyA9IHt9O1xuICAgICAgdGhpcy5mcmFncy5mb3JFYWNoKGZ1bmN0aW9uIChmcmFnKSB7XG4gICAgICAgIHJlZnNbZnJhZy5zY29wZS4ka2V5XSA9IGZpbmRWbUZyb21GcmFnKGZyYWcpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIGhhc2hbcmVmXSA9IHJlZnM7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEZvciBvcHRpb24gbGlzdHMsIHVwZGF0ZSB0aGUgY29udGFpbmluZyB2LW1vZGVsIG9uXG4gICAqIHBhcmVudCA8c2VsZWN0Pi5cbiAgICovXG5cbiAgdXBkYXRlTW9kZWw6IGZ1bmN0aW9uIHVwZGF0ZU1vZGVsKCkge1xuICAgIGlmICh0aGlzLmlzT3B0aW9uKSB7XG4gICAgICB2YXIgcGFyZW50ID0gdGhpcy5zdGFydC5wYXJlbnROb2RlO1xuICAgICAgdmFyIG1vZGVsID0gcGFyZW50ICYmIHBhcmVudC5fX3ZfbW9kZWw7XG4gICAgICBpZiAobW9kZWwpIHtcbiAgICAgICAgbW9kZWwuZm9yY2VVcGRhdGUoKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIEluc2VydCBhIGZyYWdtZW50LiBIYW5kbGVzIHN0YWdnZXJpbmcuXG4gICAqXG4gICAqIEBwYXJhbSB7RnJhZ21lbnR9IGZyYWdcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGluZGV4XG4gICAqIEBwYXJhbSB7Tm9kZX0gcHJldkVsXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gaW5Eb2N1bWVudFxuICAgKi9cblxuICBpbnNlcnQ6IGZ1bmN0aW9uIGluc2VydChmcmFnLCBpbmRleCwgcHJldkVsLCBpbkRvY3VtZW50KSB7XG4gICAgaWYgKGZyYWcuc3RhZ2dlckNiKSB7XG4gICAgICBmcmFnLnN0YWdnZXJDYi5jYW5jZWwoKTtcbiAgICAgIGZyYWcuc3RhZ2dlckNiID0gbnVsbDtcbiAgICB9XG4gICAgdmFyIHN0YWdnZXJBbW91bnQgPSB0aGlzLmdldFN0YWdnZXIoZnJhZywgaW5kZXgsIG51bGwsICdlbnRlcicpO1xuICAgIGlmIChpbkRvY3VtZW50ICYmIHN0YWdnZXJBbW91bnQpIHtcbiAgICAgIC8vIGNyZWF0ZSBhbiBhbmNob3IgYW5kIGluc2VydCBpdCBzeW5jaHJvbm91c2x5LFxuICAgICAgLy8gc28gdGhhdCB3ZSBjYW4gcmVzb2x2ZSB0aGUgY29ycmVjdCBvcmRlciB3aXRob3V0XG4gICAgICAvLyB3b3JyeWluZyBhYm91dCBzb21lIGVsZW1lbnRzIG5vdCBpbnNlcnRlZCB5ZXRcbiAgICAgIHZhciBhbmNob3IgPSBmcmFnLnN0YWdnZXJBbmNob3I7XG4gICAgICBpZiAoIWFuY2hvcikge1xuICAgICAgICBhbmNob3IgPSBmcmFnLnN0YWdnZXJBbmNob3IgPSBjcmVhdGVBbmNob3IoJ3N0YWdnZXItYW5jaG9yJyk7XG4gICAgICAgIGFuY2hvci5fX3ZmcmFnX18gPSBmcmFnO1xuICAgICAgfVxuICAgICAgYWZ0ZXIoYW5jaG9yLCBwcmV2RWwpO1xuICAgICAgdmFyIG9wID0gZnJhZy5zdGFnZ2VyQ2IgPSBjYW5jZWxsYWJsZShmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZyYWcuc3RhZ2dlckNiID0gbnVsbDtcbiAgICAgICAgZnJhZy5iZWZvcmUoYW5jaG9yKTtcbiAgICAgICAgcmVtb3ZlKGFuY2hvcik7XG4gICAgICB9KTtcbiAgICAgIHNldFRpbWVvdXQob3AsIHN0YWdnZXJBbW91bnQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBmcmFnLmJlZm9yZShwcmV2RWwubmV4dFNpYmxpbmcpO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogUmVtb3ZlIGEgZnJhZ21lbnQuIEhhbmRsZXMgc3RhZ2dlcmluZy5cbiAgICpcbiAgICogQHBhcmFtIHtGcmFnbWVudH0gZnJhZ1xuICAgKiBAcGFyYW0ge051bWJlcn0gaW5kZXhcbiAgICogQHBhcmFtIHtOdW1iZXJ9IHRvdGFsXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gaW5Eb2N1bWVudFxuICAgKi9cblxuICByZW1vdmU6IGZ1bmN0aW9uIHJlbW92ZShmcmFnLCBpbmRleCwgdG90YWwsIGluRG9jdW1lbnQpIHtcbiAgICBpZiAoZnJhZy5zdGFnZ2VyQ2IpIHtcbiAgICAgIGZyYWcuc3RhZ2dlckNiLmNhbmNlbCgpO1xuICAgICAgZnJhZy5zdGFnZ2VyQ2IgPSBudWxsO1xuICAgICAgLy8gaXQncyBub3QgcG9zc2libGUgZm9yIHRoZSBzYW1lIGZyYWcgdG8gYmUgcmVtb3ZlZFxuICAgICAgLy8gdHdpY2UsIHNvIGlmIHdlIGhhdmUgYSBwZW5kaW5nIHN0YWdnZXIgY2FsbGJhY2ssXG4gICAgICAvLyBpdCBtZWFucyB0aGlzIGZyYWcgaXMgcXVldWVkIGZvciBlbnRlciBidXQgcmVtb3ZlZFxuICAgICAgLy8gYmVmb3JlIGl0cyB0cmFuc2l0aW9uIHN0YXJ0ZWQuIFNpbmNlIGl0IGlzIGFscmVhZHlcbiAgICAgIC8vIGRlc3Ryb3llZCwgd2UgY2FuIGp1c3QgbGVhdmUgaXQgaW4gZGV0YWNoZWQgc3RhdGUuXG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciBzdGFnZ2VyQW1vdW50ID0gdGhpcy5nZXRTdGFnZ2VyKGZyYWcsIGluZGV4LCB0b3RhbCwgJ2xlYXZlJyk7XG4gICAgaWYgKGluRG9jdW1lbnQgJiYgc3RhZ2dlckFtb3VudCkge1xuICAgICAgdmFyIG9wID0gZnJhZy5zdGFnZ2VyQ2IgPSBjYW5jZWxsYWJsZShmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZyYWcuc3RhZ2dlckNiID0gbnVsbDtcbiAgICAgICAgZnJhZy5yZW1vdmUoKTtcbiAgICAgIH0pO1xuICAgICAgc2V0VGltZW91dChvcCwgc3RhZ2dlckFtb3VudCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGZyYWcucmVtb3ZlKCk7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBNb3ZlIGEgZnJhZ21lbnQgdG8gYSBuZXcgcG9zaXRpb24uXG4gICAqIEZvcmNlIG5vIHRyYW5zaXRpb24uXG4gICAqXG4gICAqIEBwYXJhbSB7RnJhZ21lbnR9IGZyYWdcbiAgICogQHBhcmFtIHtOb2RlfSBwcmV2RWxcbiAgICovXG5cbiAgbW92ZTogZnVuY3Rpb24gbW92ZShmcmFnLCBwcmV2RWwpIHtcbiAgICBmcmFnLmJlZm9yZShwcmV2RWwubmV4dFNpYmxpbmcsIGZhbHNlKTtcbiAgfSxcblxuICAvKipcbiAgICogQ2FjaGUgYSBmcmFnbWVudCB1c2luZyB0cmFjay1ieSBvciB0aGUgb2JqZWN0IGtleS5cbiAgICpcbiAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgKiBAcGFyYW0ge0ZyYWdtZW50fSBmcmFnXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBpbmRleFxuICAgKiBAcGFyYW0ge1N0cmluZ30gW2tleV1cbiAgICovXG5cbiAgY2FjaGVGcmFnOiBmdW5jdGlvbiBjYWNoZUZyYWcodmFsdWUsIGZyYWcsIGluZGV4LCBrZXkpIHtcbiAgICB2YXIgdHJhY2tCeUtleSA9IHRoaXMucGFyYW1zLnRyYWNrQnk7XG4gICAgdmFyIGNhY2hlID0gdGhpcy5jYWNoZTtcbiAgICB2YXIgcHJpbWl0aXZlID0gIWlzT2JqZWN0KHZhbHVlKTtcbiAgICB2YXIgaWQ7XG4gICAgaWYgKGtleSB8fCB0cmFja0J5S2V5IHx8IHByaW1pdGl2ZSkge1xuICAgICAgaWQgPSB0cmFja0J5S2V5ID8gdHJhY2tCeUtleSA9PT0gJyRpbmRleCcgPyBpbmRleCA6IHZhbHVlW3RyYWNrQnlLZXldIDoga2V5IHx8IHZhbHVlO1xuICAgICAgaWYgKCFjYWNoZVtpZF0pIHtcbiAgICAgICAgY2FjaGVbaWRdID0gZnJhZztcbiAgICAgIH0gZWxzZSBpZiAodHJhY2tCeUtleSAhPT0gJyRpbmRleCcpIHtcbiAgICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB0aGlzLndhcm5EdXBsaWNhdGUodmFsdWUpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZCA9IHRoaXMuaWQ7XG4gICAgICBpZiAoaGFzT3duKHZhbHVlLCBpZCkpIHtcbiAgICAgICAgaWYgKHZhbHVlW2lkXSA9PT0gbnVsbCkge1xuICAgICAgICAgIHZhbHVlW2lkXSA9IGZyYWc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB0aGlzLndhcm5EdXBsaWNhdGUodmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkZWYodmFsdWUsIGlkLCBmcmFnKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZnJhZy5yYXcgPSB2YWx1ZTtcbiAgfSxcblxuICAvKipcbiAgICogR2V0IGEgY2FjaGVkIGZyYWdtZW50IGZyb20gdGhlIHZhbHVlL2luZGV4L2tleVxuICAgKlxuICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBpbmRleFxuICAgKiBAcGFyYW0ge1N0cmluZ30ga2V5XG4gICAqIEByZXR1cm4ge0ZyYWdtZW50fVxuICAgKi9cblxuICBnZXRDYWNoZWRGcmFnOiBmdW5jdGlvbiBnZXRDYWNoZWRGcmFnKHZhbHVlLCBpbmRleCwga2V5KSB7XG4gICAgdmFyIHRyYWNrQnlLZXkgPSB0aGlzLnBhcmFtcy50cmFja0J5O1xuICAgIHZhciBwcmltaXRpdmUgPSAhaXNPYmplY3QodmFsdWUpO1xuICAgIHZhciBmcmFnO1xuICAgIGlmIChrZXkgfHwgdHJhY2tCeUtleSB8fCBwcmltaXRpdmUpIHtcbiAgICAgIHZhciBpZCA9IHRyYWNrQnlLZXkgPyB0cmFja0J5S2V5ID09PSAnJGluZGV4JyA/IGluZGV4IDogdmFsdWVbdHJhY2tCeUtleV0gOiBrZXkgfHwgdmFsdWU7XG4gICAgICBmcmFnID0gdGhpcy5jYWNoZVtpZF07XG4gICAgfSBlbHNlIHtcbiAgICAgIGZyYWcgPSB2YWx1ZVt0aGlzLmlkXTtcbiAgICB9XG4gICAgaWYgKGZyYWcgJiYgKGZyYWcucmV1c2VkIHx8IGZyYWcuZnJlc2gpKSB7XG4gICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHRoaXMud2FybkR1cGxpY2F0ZSh2YWx1ZSk7XG4gICAgfVxuICAgIHJldHVybiBmcmFnO1xuICB9LFxuXG4gIC8qKlxuICAgKiBEZWxldGUgYSBmcmFnbWVudCBmcm9tIGNhY2hlLlxuICAgKlxuICAgKiBAcGFyYW0ge0ZyYWdtZW50fSBmcmFnXG4gICAqL1xuXG4gIGRlbGV0ZUNhY2hlZEZyYWc6IGZ1bmN0aW9uIGRlbGV0ZUNhY2hlZEZyYWcoZnJhZykge1xuICAgIHZhciB2YWx1ZSA9IGZyYWcucmF3O1xuICAgIHZhciB0cmFja0J5S2V5ID0gdGhpcy5wYXJhbXMudHJhY2tCeTtcbiAgICB2YXIgc2NvcGUgPSBmcmFnLnNjb3BlO1xuICAgIHZhciBpbmRleCA9IHNjb3BlLiRpbmRleDtcbiAgICAvLyBmaXggIzk0ODogYXZvaWQgYWNjaWRlbnRhbGx5IGZhbGwgdGhyb3VnaCB0b1xuICAgIC8vIGEgcGFyZW50IHJlcGVhdGVyIHdoaWNoIGhhcHBlbnMgdG8gaGF2ZSAka2V5LlxuICAgIHZhciBrZXkgPSBoYXNPd24oc2NvcGUsICcka2V5JykgJiYgc2NvcGUuJGtleTtcbiAgICB2YXIgcHJpbWl0aXZlID0gIWlzT2JqZWN0KHZhbHVlKTtcbiAgICBpZiAodHJhY2tCeUtleSB8fCBrZXkgfHwgcHJpbWl0aXZlKSB7XG4gICAgICB2YXIgaWQgPSB0cmFja0J5S2V5ID8gdHJhY2tCeUtleSA9PT0gJyRpbmRleCcgPyBpbmRleCA6IHZhbHVlW3RyYWNrQnlLZXldIDoga2V5IHx8IHZhbHVlO1xuICAgICAgdGhpcy5jYWNoZVtpZF0gPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZVt0aGlzLmlkXSA9IG51bGw7XG4gICAgICBmcmFnLnJhdyA9IG51bGw7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIHN0YWdnZXIgYW1vdW50IGZvciBhbiBpbnNlcnRpb24vcmVtb3ZhbC5cbiAgICpcbiAgICogQHBhcmFtIHtGcmFnbWVudH0gZnJhZ1xuICAgKiBAcGFyYW0ge051bWJlcn0gaW5kZXhcbiAgICogQHBhcmFtIHtOdW1iZXJ9IHRvdGFsXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlXG4gICAqL1xuXG4gIGdldFN0YWdnZXI6IGZ1bmN0aW9uIGdldFN0YWdnZXIoZnJhZywgaW5kZXgsIHRvdGFsLCB0eXBlKSB7XG4gICAgdHlwZSA9IHR5cGUgKyAnU3RhZ2dlcic7XG4gICAgdmFyIHRyYW5zID0gZnJhZy5ub2RlLl9fdl90cmFucztcbiAgICB2YXIgaG9va3MgPSB0cmFucyAmJiB0cmFucy5ob29rcztcbiAgICB2YXIgaG9vayA9IGhvb2tzICYmIChob29rc1t0eXBlXSB8fCBob29rcy5zdGFnZ2VyKTtcbiAgICByZXR1cm4gaG9vayA/IGhvb2suY2FsbChmcmFnLCBpbmRleCwgdG90YWwpIDogaW5kZXggKiBwYXJzZUludCh0aGlzLnBhcmFtc1t0eXBlXSB8fCB0aGlzLnBhcmFtcy5zdGFnZ2VyLCAxMCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFByZS1wcm9jZXNzIHRoZSB2YWx1ZSBiZWZvcmUgcGlwaW5nIGl0IHRocm91Z2ggdGhlXG4gICAqIGZpbHRlcnMuIFRoaXMgaXMgcGFzc2VkIHRvIGFuZCBjYWxsZWQgYnkgdGhlIHdhdGNoZXIuXG4gICAqL1xuXG4gIF9wcmVQcm9jZXNzOiBmdW5jdGlvbiBfcHJlUHJvY2Vzcyh2YWx1ZSkge1xuICAgIC8vIHJlZ2FyZGxlc3Mgb2YgdHlwZSwgc3RvcmUgdGhlIHVuLWZpbHRlcmVkIHJhdyB2YWx1ZS5cbiAgICB0aGlzLnJhd1ZhbHVlID0gdmFsdWU7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9LFxuXG4gIC8qKlxuICAgKiBQb3N0LXByb2Nlc3MgdGhlIHZhbHVlIGFmdGVyIGl0IGhhcyBiZWVuIHBpcGVkIHRocm91Z2hcbiAgICogdGhlIGZpbHRlcnMuIFRoaXMgaXMgcGFzc2VkIHRvIGFuZCBjYWxsZWQgYnkgdGhlIHdhdGNoZXIuXG4gICAqXG4gICAqIEl0IGlzIG5lY2Vzc2FyeSBmb3IgdGhpcyB0byBiZSBjYWxsZWQgZHVyaW5nIHRoZVxuICAgKiB3YXRoY2VyJ3MgZGVwZW5kZW5jeSBjb2xsZWN0aW9uIHBoYXNlIGJlY2F1c2Ugd2Ugd2FudFxuICAgKiB0aGUgdi1mb3IgdG8gdXBkYXRlIHdoZW4gdGhlIHNvdXJjZSBPYmplY3QgaXMgbXV0YXRlZC5cbiAgICovXG5cbiAgX3Bvc3RQcm9jZXNzOiBmdW5jdGlvbiBfcG9zdFByb2Nlc3ModmFsdWUpIHtcbiAgICBpZiAoaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9IGVsc2UgaWYgKGlzUGxhaW5PYmplY3QodmFsdWUpKSB7XG4gICAgICAvLyBjb252ZXJ0IHBsYWluIG9iamVjdCB0byBhcnJheS5cbiAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXModmFsdWUpO1xuICAgICAgdmFyIGkgPSBrZXlzLmxlbmd0aDtcbiAgICAgIHZhciByZXMgPSBuZXcgQXJyYXkoaSk7XG4gICAgICB2YXIga2V5O1xuICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICBrZXkgPSBrZXlzW2ldO1xuICAgICAgICByZXNbaV0gPSB7XG4gICAgICAgICAgJGtleToga2V5LFxuICAgICAgICAgICR2YWx1ZTogdmFsdWVba2V5XVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlcztcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgdmFsdWUgPSByYW5nZSh2YWx1ZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdmFsdWUgfHwgW107XG4gICAgfVxuICB9LFxuXG4gIHVuYmluZDogZnVuY3Rpb24gdW5iaW5kKCkge1xuICAgIGlmICh0aGlzLmRlc2NyaXB0b3IucmVmKSB7XG4gICAgICAodGhpcy5fc2NvcGUgfHwgdGhpcy52bSkuJHJlZnNbdGhpcy5kZXNjcmlwdG9yLnJlZl0gPSBudWxsO1xuICAgIH1cbiAgICBpZiAodGhpcy5mcmFncykge1xuICAgICAgdmFyIGkgPSB0aGlzLmZyYWdzLmxlbmd0aDtcbiAgICAgIHZhciBmcmFnO1xuICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICBmcmFnID0gdGhpcy5mcmFnc1tpXTtcbiAgICAgICAgdGhpcy5kZWxldGVDYWNoZWRGcmFnKGZyYWcpO1xuICAgICAgICBmcmFnLmRlc3Ryb3koKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn07XG5cbi8qKlxuICogSGVscGVyIHRvIGZpbmQgdGhlIHByZXZpb3VzIGVsZW1lbnQgdGhhdCBpcyBhIGZyYWdtZW50XG4gKiBhbmNob3IuIFRoaXMgaXMgbmVjZXNzYXJ5IGJlY2F1c2UgYSBkZXN0cm95ZWQgZnJhZydzXG4gKiBlbGVtZW50IGNvdWxkIHN0aWxsIGJlIGxpbmdlcmluZyBpbiB0aGUgRE9NIGJlZm9yZSBpdHNcbiAqIGxlYXZpbmcgdHJhbnNpdGlvbiBmaW5pc2hlcywgYnV0IGl0cyBpbnNlcnRlZCBmbGFnXG4gKiBzaG91bGQgaGF2ZSBiZWVuIHNldCB0byBmYWxzZSBzbyB3ZSBjYW4gc2tpcCB0aGVtLlxuICpcbiAqIElmIHRoaXMgaXMgYSBibG9jayByZXBlYXQsIHdlIHdhbnQgdG8gbWFrZSBzdXJlIHdlIG9ubHlcbiAqIHJldHVybiBmcmFnIHRoYXQgaXMgYm91bmQgdG8gdGhpcyB2LWZvci4gKHNlZSAjOTI5KVxuICpcbiAqIEBwYXJhbSB7RnJhZ21lbnR9IGZyYWdcbiAqIEBwYXJhbSB7Q29tbWVudHxUZXh0fSBhbmNob3JcbiAqIEBwYXJhbSB7U3RyaW5nfSBpZFxuICogQHJldHVybiB7RnJhZ21lbnR9XG4gKi9cblxuZnVuY3Rpb24gZmluZFByZXZGcmFnKGZyYWcsIGFuY2hvciwgaWQpIHtcbiAgdmFyIGVsID0gZnJhZy5ub2RlLnByZXZpb3VzU2libGluZztcbiAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gIGlmICghZWwpIHJldHVybjtcbiAgZnJhZyA9IGVsLl9fdmZyYWdfXztcbiAgd2hpbGUgKCghZnJhZyB8fCBmcmFnLmZvcklkICE9PSBpZCB8fCAhZnJhZy5pbnNlcnRlZCkgJiYgZWwgIT09IGFuY2hvcikge1xuICAgIGVsID0gZWwucHJldmlvdXNTaWJsaW5nO1xuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgIGlmICghZWwpIHJldHVybjtcbiAgICBmcmFnID0gZWwuX192ZnJhZ19fO1xuICB9XG4gIHJldHVybiBmcmFnO1xufVxuXG4vKipcbiAqIEZpbmQgYSB2bSBmcm9tIGEgZnJhZ21lbnQuXG4gKlxuICogQHBhcmFtIHtGcmFnbWVudH0gZnJhZ1xuICogQHJldHVybiB7VnVlfHVuZGVmaW5lZH1cbiAqL1xuXG5mdW5jdGlvbiBmaW5kVm1Gcm9tRnJhZyhmcmFnKSB7XG4gIHZhciBub2RlID0gZnJhZy5ub2RlO1xuICAvLyBoYW5kbGUgbXVsdGktbm9kZSBmcmFnXG4gIGlmIChmcmFnLmVuZCkge1xuICAgIHdoaWxlICghbm9kZS5fX3Z1ZV9fICYmIG5vZGUgIT09IGZyYWcuZW5kICYmIG5vZGUubmV4dFNpYmxpbmcpIHtcbiAgICAgIG5vZGUgPSBub2RlLm5leHRTaWJsaW5nO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbm9kZS5fX3Z1ZV9fO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIHJhbmdlIGFycmF5IGZyb20gZ2l2ZW4gbnVtYmVyLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBuXG4gKiBAcmV0dXJuIHtBcnJheX1cbiAqL1xuXG5mdW5jdGlvbiByYW5nZShuKSB7XG4gIHZhciBpID0gLTE7XG4gIHZhciByZXQgPSBuZXcgQXJyYXkobik7XG4gIHdoaWxlICgrK2kgPCBuKSB7XG4gICAgcmV0W2ldID0gaTtcbiAgfVxuICByZXR1cm4gcmV0O1xufVxuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICB2Rm9yLndhcm5EdXBsaWNhdGUgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICB3YXJuKCdEdXBsaWNhdGUgdmFsdWUgZm91bmQgaW4gdi1mb3I9XCInICsgdGhpcy5kZXNjcmlwdG9yLnJhdyArICdcIjogJyArIEpTT04uc3RyaW5naWZ5KHZhbHVlKSArICcuIFVzZSB0cmFjay1ieT1cIiRpbmRleFwiIGlmICcgKyAneW91IGFyZSBleHBlY3RpbmcgZHVwbGljYXRlIHZhbHVlcy4nKTtcbiAgfTtcbn1cblxudmFyIGh0bWwgPSB7XG5cbiAgYmluZDogZnVuY3Rpb24gYmluZCgpIHtcbiAgICAvLyBhIGNvbW1lbnQgbm9kZSBtZWFucyB0aGlzIGlzIGEgYmluZGluZyBmb3JcbiAgICAvLyB7e3sgaW5saW5lIHVuZXNjYXBlZCBodG1sIH19fVxuICAgIGlmICh0aGlzLmVsLm5vZGVUeXBlID09PSA4KSB7XG4gICAgICAvLyBob2xkIG5vZGVzXG4gICAgICB0aGlzLm5vZGVzID0gW107XG4gICAgICAvLyByZXBsYWNlIHRoZSBwbGFjZWhvbGRlciB3aXRoIHByb3BlciBhbmNob3JcbiAgICAgIHRoaXMuYW5jaG9yID0gY3JlYXRlQW5jaG9yKCd2LWh0bWwnKTtcbiAgICAgIHJlcGxhY2UodGhpcy5lbCwgdGhpcy5hbmNob3IpO1xuICAgIH1cbiAgfSxcblxuICB1cGRhdGU6IGZ1bmN0aW9uIHVwZGF0ZSh2YWx1ZSkge1xuICAgIHZhbHVlID0gX3RvU3RyaW5nKHZhbHVlKTtcbiAgICBpZiAodGhpcy5ub2Rlcykge1xuICAgICAgdGhpcy5zd2FwKHZhbHVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5lbC5pbm5lckhUTUwgPSB2YWx1ZTtcbiAgICB9XG4gIH0sXG5cbiAgc3dhcDogZnVuY3Rpb24gc3dhcCh2YWx1ZSkge1xuICAgIC8vIHJlbW92ZSBvbGQgbm9kZXNcbiAgICB2YXIgaSA9IHRoaXMubm9kZXMubGVuZ3RoO1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIHJlbW92ZSh0aGlzLm5vZGVzW2ldKTtcbiAgICB9XG4gICAgLy8gY29udmVydCBuZXcgdmFsdWUgdG8gYSBmcmFnbWVudFxuICAgIC8vIGRvIG5vdCBhdHRlbXB0IHRvIHJldHJpZXZlIGZyb20gaWQgc2VsZWN0b3JcbiAgICB2YXIgZnJhZyA9IHBhcnNlVGVtcGxhdGUodmFsdWUsIHRydWUsIHRydWUpO1xuICAgIC8vIHNhdmUgYSByZWZlcmVuY2UgdG8gdGhlc2Ugbm9kZXMgc28gd2UgY2FuIHJlbW92ZSBsYXRlclxuICAgIHRoaXMubm9kZXMgPSB0b0FycmF5KGZyYWcuY2hpbGROb2Rlcyk7XG4gICAgYmVmb3JlKGZyYWcsIHRoaXMuYW5jaG9yKTtcbiAgfVxufTtcblxudmFyIHRleHQgPSB7XG5cbiAgYmluZDogZnVuY3Rpb24gYmluZCgpIHtcbiAgICB0aGlzLmF0dHIgPSB0aGlzLmVsLm5vZGVUeXBlID09PSAzID8gJ2RhdGEnIDogJ3RleHRDb250ZW50JztcbiAgfSxcblxuICB1cGRhdGU6IGZ1bmN0aW9uIHVwZGF0ZSh2YWx1ZSkge1xuICAgIHRoaXMuZWxbdGhpcy5hdHRyXSA9IF90b1N0cmluZyh2YWx1ZSk7XG4gIH1cbn07XG5cbi8vIG11c3QgZXhwb3J0IHBsYWluIG9iamVjdFxudmFyIHB1YmxpY0RpcmVjdGl2ZXMgPSB7XG4gIHRleHQ6IHRleHQsXG4gIGh0bWw6IGh0bWwsXG4gICdmb3InOiB2Rm9yLFxuICAnaWYnOiB2SWYsXG4gIHNob3c6IHNob3csXG4gIG1vZGVsOiBtb2RlbCxcbiAgb246IG9uLFxuICBiaW5kOiBiaW5kLFxuICBlbDogZWwsXG4gIHJlZjogcmVmLFxuICBjbG9hazogY2xvYWtcbn07XG5cbnZhciBxdWV1ZSQxID0gW107XG52YXIgcXVldWVkID0gZmFsc2U7XG5cbi8qKlxuICogUHVzaCBhIGpvYiBpbnRvIHRoZSBxdWV1ZS5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBqb2JcbiAqL1xuXG5mdW5jdGlvbiBwdXNoSm9iKGpvYikge1xuICBxdWV1ZSQxLnB1c2goam9iKTtcbiAgaWYgKCFxdWV1ZWQpIHtcbiAgICBxdWV1ZWQgPSB0cnVlO1xuICAgIG5leHRUaWNrKGZsdXNoKTtcbiAgfVxufVxuXG4vKipcbiAqIEZsdXNoIHRoZSBxdWV1ZSwgYW5kIGRvIG9uZSBmb3JjZWQgcmVmbG93IGJlZm9yZVxuICogdHJpZ2dlcmluZyB0cmFuc2l0aW9ucy5cbiAqL1xuXG5mdW5jdGlvbiBmbHVzaCgpIHtcbiAgLy8gRm9yY2UgbGF5b3V0XG4gIHZhciBmID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50Lm9mZnNldEhlaWdodDtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBxdWV1ZSQxLmxlbmd0aDsgaSsrKSB7XG4gICAgcXVldWUkMVtpXSgpO1xuICB9XG4gIHF1ZXVlJDEgPSBbXTtcbiAgcXVldWVkID0gZmFsc2U7XG4gIC8vIGR1bW15IHJldHVybiwgc28ganMgbGludGVycyBkb24ndCBjb21wbGFpbiBhYm91dFxuICAvLyB1bnVzZWQgdmFyaWFibGUgZlxuICByZXR1cm4gZjtcbn1cblxudmFyIFRZUEVfVFJBTlNJVElPTiA9IDE7XG52YXIgVFlQRV9BTklNQVRJT04gPSAyO1xudmFyIHRyYW5zRHVyYXRpb25Qcm9wID0gdHJhbnNpdGlvblByb3AgKyAnRHVyYXRpb24nO1xudmFyIGFuaW1EdXJhdGlvblByb3AgPSBhbmltYXRpb25Qcm9wICsgJ0R1cmF0aW9uJztcblxuLyoqXG4gKiBBIFRyYW5zaXRpb24gb2JqZWN0IHRoYXQgZW5jYXBzdWxhdGVzIHRoZSBzdGF0ZSBhbmQgbG9naWNcbiAqIG9mIHRoZSB0cmFuc2l0aW9uLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEBwYXJhbSB7U3RyaW5nfSBpZFxuICogQHBhcmFtIHtPYmplY3R9IGhvb2tzXG4gKiBAcGFyYW0ge1Z1ZX0gdm1cbiAqL1xuZnVuY3Rpb24gVHJhbnNpdGlvbihlbCwgaWQsIGhvb2tzLCB2bSkge1xuICB0aGlzLmlkID0gaWQ7XG4gIHRoaXMuZWwgPSBlbDtcbiAgdGhpcy5lbnRlckNsYXNzID0gaWQgKyAnLWVudGVyJztcbiAgdGhpcy5sZWF2ZUNsYXNzID0gaWQgKyAnLWxlYXZlJztcbiAgdGhpcy5ob29rcyA9IGhvb2tzO1xuICB0aGlzLnZtID0gdm07XG4gIC8vIGFzeW5jIHN0YXRlXG4gIHRoaXMucGVuZGluZ0Nzc0V2ZW50ID0gdGhpcy5wZW5kaW5nQ3NzQ2IgPSB0aGlzLmNhbmNlbCA9IHRoaXMucGVuZGluZ0pzQ2IgPSB0aGlzLm9wID0gdGhpcy5jYiA9IG51bGw7XG4gIHRoaXMuanVzdEVudGVyZWQgPSBmYWxzZTtcbiAgdGhpcy5lbnRlcmVkID0gdGhpcy5sZWZ0ID0gZmFsc2U7XG4gIHRoaXMudHlwZUNhY2hlID0ge307XG4gIC8vIGJpbmRcbiAgdmFyIHNlbGYgPSB0aGlzO1snZW50ZXJOZXh0VGljaycsICdlbnRlckRvbmUnLCAnbGVhdmVOZXh0VGljaycsICdsZWF2ZURvbmUnXS5mb3JFYWNoKGZ1bmN0aW9uIChtKSB7XG4gICAgc2VsZlttXSA9IGJpbmQkMShzZWxmW21dLCBzZWxmKTtcbiAgfSk7XG59XG5cbnZhciBwJDEgPSBUcmFuc2l0aW9uLnByb3RvdHlwZTtcblxuLyoqXG4gKiBTdGFydCBhbiBlbnRlcmluZyB0cmFuc2l0aW9uLlxuICpcbiAqIDEuIGVudGVyIHRyYW5zaXRpb24gdHJpZ2dlcmVkXG4gKiAyLiBjYWxsIGJlZm9yZUVudGVyIGhvb2tcbiAqIDMuIGFkZCBlbnRlciBjbGFzc1xuICogNC4gaW5zZXJ0L3Nob3cgZWxlbWVudFxuICogNS4gY2FsbCBlbnRlciBob29rICh3aXRoIHBvc3NpYmxlIGV4cGxpY2l0IGpzIGNhbGxiYWNrKVxuICogNi4gcmVmbG93XG4gKiA3LiBiYXNlZCBvbiB0cmFuc2l0aW9uIHR5cGU6XG4gKiAgICAtIHRyYW5zaXRpb246XG4gKiAgICAgICAgcmVtb3ZlIGNsYXNzIG5vdywgd2FpdCBmb3IgdHJhbnNpdGlvbmVuZCxcbiAqICAgICAgICB0aGVuIGRvbmUgaWYgdGhlcmUncyBubyBleHBsaWNpdCBqcyBjYWxsYmFjay5cbiAqICAgIC0gYW5pbWF0aW9uOlxuICogICAgICAgIHdhaXQgZm9yIGFuaW1hdGlvbmVuZCwgcmVtb3ZlIGNsYXNzLFxuICogICAgICAgIHRoZW4gZG9uZSBpZiB0aGVyZSdzIG5vIGV4cGxpY2l0IGpzIGNhbGxiYWNrLlxuICogICAgLSBubyBjc3MgdHJhbnNpdGlvbjpcbiAqICAgICAgICBkb25lIG5vdyBpZiB0aGVyZSdzIG5vIGV4cGxpY2l0IGpzIGNhbGxiYWNrLlxuICogOC4gd2FpdCBmb3IgZWl0aGVyIGRvbmUgb3IganMgY2FsbGJhY2ssIHRoZW4gY2FsbFxuICogICAgYWZ0ZXJFbnRlciBob29rLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wIC0gaW5zZXJ0L3Nob3cgdGhlIGVsZW1lbnRcbiAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYl1cbiAqL1xuXG5wJDEuZW50ZXIgPSBmdW5jdGlvbiAob3AsIGNiKSB7XG4gIHRoaXMuY2FuY2VsUGVuZGluZygpO1xuICB0aGlzLmNhbGxIb29rKCdiZWZvcmVFbnRlcicpO1xuICB0aGlzLmNiID0gY2I7XG4gIGFkZENsYXNzKHRoaXMuZWwsIHRoaXMuZW50ZXJDbGFzcyk7XG4gIG9wKCk7XG4gIHRoaXMuZW50ZXJlZCA9IGZhbHNlO1xuICB0aGlzLmNhbGxIb29rV2l0aENiKCdlbnRlcicpO1xuICBpZiAodGhpcy5lbnRlcmVkKSB7XG4gICAgcmV0dXJuOyAvLyB1c2VyIGNhbGxlZCBkb25lIHN5bmNocm9ub3VzbHkuXG4gIH1cbiAgdGhpcy5jYW5jZWwgPSB0aGlzLmhvb2tzICYmIHRoaXMuaG9va3MuZW50ZXJDYW5jZWxsZWQ7XG4gIHB1c2hKb2IodGhpcy5lbnRlck5leHRUaWNrKTtcbn07XG5cbi8qKlxuICogVGhlIFwibmV4dFRpY2tcIiBwaGFzZSBvZiBhbiBlbnRlcmluZyB0cmFuc2l0aW9uLCB3aGljaCBpc1xuICogdG8gYmUgcHVzaGVkIGludG8gYSBxdWV1ZSBhbmQgZXhlY3V0ZWQgYWZ0ZXIgYSByZWZsb3cgc29cbiAqIHRoYXQgcmVtb3ZpbmcgdGhlIGNsYXNzIGNhbiB0cmlnZ2VyIGEgQ1NTIHRyYW5zaXRpb24uXG4gKi9cblxucCQxLmVudGVyTmV4dFRpY2sgPSBmdW5jdGlvbiAoKSB7XG5cbiAgLy8gSW1wb3J0YW50IGhhY2s6XG4gIC8vIGluIENocm9tZSwgaWYgYSBqdXN0LWVudGVyZWQgZWxlbWVudCBpcyBhcHBsaWVkIHRoZVxuICAvLyBsZWF2ZSBjbGFzcyB3aGlsZSBpdHMgaW50ZXJwb2xhdGVkIHByb3BlcnR5IHN0aWxsIGhhc1xuICAvLyBhIHZlcnkgc21hbGwgdmFsdWUgKHdpdGhpbiBvbmUgZnJhbWUpLCBDaHJvbWUgd2lsbFxuICAvLyBza2lwIHRoZSBsZWF2ZSB0cmFuc2l0aW9uIGVudGlyZWx5IGFuZCBub3QgZmlyaW5nIHRoZVxuICAvLyB0cmFuc3Rpb25lbmQgZXZlbnQuIFRoZXJlZm9yZSB3ZSBuZWVkIHRvIHByb3RlY3RlZFxuICAvLyBhZ2FpbnN0IHN1Y2ggY2FzZXMgdXNpbmcgYSBvbmUtZnJhbWUgdGltZW91dC5cbiAgdGhpcy5qdXN0RW50ZXJlZCA9IHRydWU7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgc2VsZi5qdXN0RW50ZXJlZCA9IGZhbHNlO1xuICB9LCAxNyk7XG5cbiAgdmFyIGVudGVyRG9uZSA9IHRoaXMuZW50ZXJEb25lO1xuICB2YXIgdHlwZSA9IHRoaXMuZ2V0Q3NzVHJhbnNpdGlvblR5cGUodGhpcy5lbnRlckNsYXNzKTtcbiAgaWYgKCF0aGlzLnBlbmRpbmdKc0NiKSB7XG4gICAgaWYgKHR5cGUgPT09IFRZUEVfVFJBTlNJVElPTikge1xuICAgICAgLy8gdHJpZ2dlciB0cmFuc2l0aW9uIGJ5IHJlbW92aW5nIGVudGVyIGNsYXNzIG5vd1xuICAgICAgcmVtb3ZlQ2xhc3ModGhpcy5lbCwgdGhpcy5lbnRlckNsYXNzKTtcbiAgICAgIHRoaXMuc2V0dXBDc3NDYih0cmFuc2l0aW9uRW5kRXZlbnQsIGVudGVyRG9uZSk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09PSBUWVBFX0FOSU1BVElPTikge1xuICAgICAgdGhpcy5zZXR1cENzc0NiKGFuaW1hdGlvbkVuZEV2ZW50LCBlbnRlckRvbmUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBlbnRlckRvbmUoKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gVFlQRV9UUkFOU0lUSU9OKSB7XG4gICAgcmVtb3ZlQ2xhc3ModGhpcy5lbCwgdGhpcy5lbnRlckNsYXNzKTtcbiAgfVxufTtcblxuLyoqXG4gKiBUaGUgXCJjbGVhbnVwXCIgcGhhc2Ugb2YgYW4gZW50ZXJpbmcgdHJhbnNpdGlvbi5cbiAqL1xuXG5wJDEuZW50ZXJEb25lID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLmVudGVyZWQgPSB0cnVlO1xuICB0aGlzLmNhbmNlbCA9IHRoaXMucGVuZGluZ0pzQ2IgPSBudWxsO1xuICByZW1vdmVDbGFzcyh0aGlzLmVsLCB0aGlzLmVudGVyQ2xhc3MpO1xuICB0aGlzLmNhbGxIb29rKCdhZnRlckVudGVyJyk7XG4gIGlmICh0aGlzLmNiKSB0aGlzLmNiKCk7XG59O1xuXG4vKipcbiAqIFN0YXJ0IGEgbGVhdmluZyB0cmFuc2l0aW9uLlxuICpcbiAqIDEuIGxlYXZlIHRyYW5zaXRpb24gdHJpZ2dlcmVkLlxuICogMi4gY2FsbCBiZWZvcmVMZWF2ZSBob29rXG4gKiAzLiBhZGQgbGVhdmUgY2xhc3MgKHRyaWdnZXIgY3NzIHRyYW5zaXRpb24pXG4gKiA0LiBjYWxsIGxlYXZlIGhvb2sgKHdpdGggcG9zc2libGUgZXhwbGljaXQganMgY2FsbGJhY2spXG4gKiA1LiByZWZsb3cgaWYgbm8gZXhwbGljaXQganMgY2FsbGJhY2sgaXMgcHJvdmlkZWRcbiAqIDYuIGJhc2VkIG9uIHRyYW5zaXRpb24gdHlwZTpcbiAqICAgIC0gdHJhbnNpdGlvbiBvciBhbmltYXRpb246XG4gKiAgICAgICAgd2FpdCBmb3IgZW5kIGV2ZW50LCByZW1vdmUgY2xhc3MsIHRoZW4gZG9uZSBpZlxuICogICAgICAgIHRoZXJlJ3Mgbm8gZXhwbGljaXQganMgY2FsbGJhY2suXG4gKiAgICAtIG5vIGNzcyB0cmFuc2l0aW9uOlxuICogICAgICAgIGRvbmUgaWYgdGhlcmUncyBubyBleHBsaWNpdCBqcyBjYWxsYmFjay5cbiAqIDcuIHdhaXQgZm9yIGVpdGhlciBkb25lIG9yIGpzIGNhbGxiYWNrLCB0aGVuIGNhbGxcbiAqICAgIGFmdGVyTGVhdmUgaG9vay5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcCAtIHJlbW92ZS9oaWRlIHRoZSBlbGVtZW50XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2JdXG4gKi9cblxucCQxLmxlYXZlID0gZnVuY3Rpb24gKG9wLCBjYikge1xuICB0aGlzLmNhbmNlbFBlbmRpbmcoKTtcbiAgdGhpcy5jYWxsSG9vaygnYmVmb3JlTGVhdmUnKTtcbiAgdGhpcy5vcCA9IG9wO1xuICB0aGlzLmNiID0gY2I7XG4gIGFkZENsYXNzKHRoaXMuZWwsIHRoaXMubGVhdmVDbGFzcyk7XG4gIHRoaXMubGVmdCA9IGZhbHNlO1xuICB0aGlzLmNhbGxIb29rV2l0aENiKCdsZWF2ZScpO1xuICBpZiAodGhpcy5sZWZ0KSB7XG4gICAgcmV0dXJuOyAvLyB1c2VyIGNhbGxlZCBkb25lIHN5bmNocm9ub3VzbHkuXG4gIH1cbiAgdGhpcy5jYW5jZWwgPSB0aGlzLmhvb2tzICYmIHRoaXMuaG9va3MubGVhdmVDYW5jZWxsZWQ7XG4gIC8vIG9ubHkgbmVlZCB0byBoYW5kbGUgbGVhdmVEb25lIGlmXG4gIC8vIDEuIHRoZSB0cmFuc2l0aW9uIGlzIGFscmVhZHkgZG9uZSAoc3luY2hyb25vdXNseSBjYWxsZWRcbiAgLy8gICAgYnkgdGhlIHVzZXIsIHdoaWNoIGNhdXNlcyB0aGlzLm9wIHNldCB0byBudWxsKVxuICAvLyAyLiB0aGVyZSdzIG5vIGV4cGxpY2l0IGpzIGNhbGxiYWNrXG4gIGlmICh0aGlzLm9wICYmICF0aGlzLnBlbmRpbmdKc0NiKSB7XG4gICAgLy8gaWYgYSBDU1MgdHJhbnNpdGlvbiBsZWF2ZXMgaW1tZWRpYXRlbHkgYWZ0ZXIgZW50ZXIsXG4gICAgLy8gdGhlIHRyYW5zaXRpb25lbmQgZXZlbnQgbmV2ZXIgZmlyZXMuIHRoZXJlZm9yZSB3ZVxuICAgIC8vIGRldGVjdCBzdWNoIGNhc2VzIGFuZCBlbmQgdGhlIGxlYXZlIGltbWVkaWF0ZWx5LlxuICAgIGlmICh0aGlzLmp1c3RFbnRlcmVkKSB7XG4gICAgICB0aGlzLmxlYXZlRG9uZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBwdXNoSm9iKHRoaXMubGVhdmVOZXh0VGljayk7XG4gICAgfVxuICB9XG59O1xuXG4vKipcbiAqIFRoZSBcIm5leHRUaWNrXCIgcGhhc2Ugb2YgYSBsZWF2aW5nIHRyYW5zaXRpb24uXG4gKi9cblxucCQxLmxlYXZlTmV4dFRpY2sgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciB0eXBlID0gdGhpcy5nZXRDc3NUcmFuc2l0aW9uVHlwZSh0aGlzLmxlYXZlQ2xhc3MpO1xuICBpZiAodHlwZSkge1xuICAgIHZhciBldmVudCA9IHR5cGUgPT09IFRZUEVfVFJBTlNJVElPTiA/IHRyYW5zaXRpb25FbmRFdmVudCA6IGFuaW1hdGlvbkVuZEV2ZW50O1xuICAgIHRoaXMuc2V0dXBDc3NDYihldmVudCwgdGhpcy5sZWF2ZURvbmUpO1xuICB9IGVsc2Uge1xuICAgIHRoaXMubGVhdmVEb25lKCk7XG4gIH1cbn07XG5cbi8qKlxuICogVGhlIFwiY2xlYW51cFwiIHBoYXNlIG9mIGEgbGVhdmluZyB0cmFuc2l0aW9uLlxuICovXG5cbnAkMS5sZWF2ZURvbmUgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMubGVmdCA9IHRydWU7XG4gIHRoaXMuY2FuY2VsID0gdGhpcy5wZW5kaW5nSnNDYiA9IG51bGw7XG4gIHRoaXMub3AoKTtcbiAgcmVtb3ZlQ2xhc3ModGhpcy5lbCwgdGhpcy5sZWF2ZUNsYXNzKTtcbiAgdGhpcy5jYWxsSG9vaygnYWZ0ZXJMZWF2ZScpO1xuICBpZiAodGhpcy5jYikgdGhpcy5jYigpO1xuICB0aGlzLm9wID0gbnVsbDtcbn07XG5cbi8qKlxuICogQ2FuY2VsIGFueSBwZW5kaW5nIGNhbGxiYWNrcyBmcm9tIGEgcHJldmlvdXNseSBydW5uaW5nXG4gKiBidXQgbm90IGZpbmlzaGVkIHRyYW5zaXRpb24uXG4gKi9cblxucCQxLmNhbmNlbFBlbmRpbmcgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMub3AgPSB0aGlzLmNiID0gbnVsbDtcbiAgdmFyIGhhc1BlbmRpbmcgPSBmYWxzZTtcbiAgaWYgKHRoaXMucGVuZGluZ0Nzc0NiKSB7XG4gICAgaGFzUGVuZGluZyA9IHRydWU7XG4gICAgb2ZmKHRoaXMuZWwsIHRoaXMucGVuZGluZ0Nzc0V2ZW50LCB0aGlzLnBlbmRpbmdDc3NDYik7XG4gICAgdGhpcy5wZW5kaW5nQ3NzRXZlbnQgPSB0aGlzLnBlbmRpbmdDc3NDYiA9IG51bGw7XG4gIH1cbiAgaWYgKHRoaXMucGVuZGluZ0pzQ2IpIHtcbiAgICBoYXNQZW5kaW5nID0gdHJ1ZTtcbiAgICB0aGlzLnBlbmRpbmdKc0NiLmNhbmNlbCgpO1xuICAgIHRoaXMucGVuZGluZ0pzQ2IgPSBudWxsO1xuICB9XG4gIGlmIChoYXNQZW5kaW5nKSB7XG4gICAgcmVtb3ZlQ2xhc3ModGhpcy5lbCwgdGhpcy5lbnRlckNsYXNzKTtcbiAgICByZW1vdmVDbGFzcyh0aGlzLmVsLCB0aGlzLmxlYXZlQ2xhc3MpO1xuICB9XG4gIGlmICh0aGlzLmNhbmNlbCkge1xuICAgIHRoaXMuY2FuY2VsLmNhbGwodGhpcy52bSwgdGhpcy5lbCk7XG4gICAgdGhpcy5jYW5jZWwgPSBudWxsO1xuICB9XG59O1xuXG4vKipcbiAqIENhbGwgYSB1c2VyLXByb3ZpZGVkIHN5bmNocm9ub3VzIGhvb2sgZnVuY3Rpb24uXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHR5cGVcbiAqL1xuXG5wJDEuY2FsbEhvb2sgPSBmdW5jdGlvbiAodHlwZSkge1xuICBpZiAodGhpcy5ob29rcyAmJiB0aGlzLmhvb2tzW3R5cGVdKSB7XG4gICAgdGhpcy5ob29rc1t0eXBlXS5jYWxsKHRoaXMudm0sIHRoaXMuZWwpO1xuICB9XG59O1xuXG4vKipcbiAqIENhbGwgYSB1c2VyLXByb3ZpZGVkLCBwb3RlbnRpYWxseS1hc3luYyBob29rIGZ1bmN0aW9uLlxuICogV2UgY2hlY2sgZm9yIHRoZSBsZW5ndGggb2YgYXJndW1lbnRzIHRvIHNlZSBpZiB0aGUgaG9va1xuICogZXhwZWN0cyBhIGBkb25lYCBjYWxsYmFjay4gSWYgdHJ1ZSwgdGhlIHRyYW5zaXRpb24ncyBlbmRcbiAqIHdpbGwgYmUgZGV0ZXJtaW5lZCBieSB3aGVuIHRoZSB1c2VyIGNhbGxzIHRoYXQgY2FsbGJhY2s7XG4gKiBvdGhlcndpc2UsIHRoZSBlbmQgaXMgZGV0ZXJtaW5lZCBieSB0aGUgQ1NTIHRyYW5zaXRpb24gb3JcbiAqIGFuaW1hdGlvbi5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdHlwZVxuICovXG5cbnAkMS5jYWxsSG9va1dpdGhDYiA9IGZ1bmN0aW9uICh0eXBlKSB7XG4gIHZhciBob29rID0gdGhpcy5ob29rcyAmJiB0aGlzLmhvb2tzW3R5cGVdO1xuICBpZiAoaG9vaykge1xuICAgIGlmIChob29rLmxlbmd0aCA+IDEpIHtcbiAgICAgIHRoaXMucGVuZGluZ0pzQ2IgPSBjYW5jZWxsYWJsZSh0aGlzW3R5cGUgKyAnRG9uZSddKTtcbiAgICB9XG4gICAgaG9vay5jYWxsKHRoaXMudm0sIHRoaXMuZWwsIHRoaXMucGVuZGluZ0pzQ2IpO1xuICB9XG59O1xuXG4vKipcbiAqIEdldCBhbiBlbGVtZW50J3MgdHJhbnNpdGlvbiB0eXBlIGJhc2VkIG9uIHRoZVxuICogY2FsY3VsYXRlZCBzdHlsZXMuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGNsYXNzTmFtZVxuICogQHJldHVybiB7TnVtYmVyfVxuICovXG5cbnAkMS5nZXRDc3NUcmFuc2l0aW9uVHlwZSA9IGZ1bmN0aW9uIChjbGFzc05hbWUpIHtcbiAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gIGlmICghdHJhbnNpdGlvbkVuZEV2ZW50IHx8XG4gIC8vIHNraXAgQ1NTIHRyYW5zaXRpb25zIGlmIHBhZ2UgaXMgbm90IHZpc2libGUgLVxuICAvLyB0aGlzIHNvbHZlcyB0aGUgaXNzdWUgb2YgdHJhbnNpdGlvbmVuZCBldmVudHMgbm90XG4gIC8vIGZpcmluZyB1bnRpbCB0aGUgcGFnZSBpcyB2aXNpYmxlIGFnYWluLlxuICAvLyBwYWdlVmlzaWJpbGl0eSBBUEkgaXMgc3VwcG9ydGVkIGluIElFMTArLCBzYW1lIGFzXG4gIC8vIENTUyB0cmFuc2l0aW9ucy5cbiAgZG9jdW1lbnQuaGlkZGVuIHx8XG4gIC8vIGV4cGxpY2l0IGpzLW9ubHkgdHJhbnNpdGlvblxuICB0aGlzLmhvb2tzICYmIHRoaXMuaG9va3MuY3NzID09PSBmYWxzZSB8fFxuICAvLyBlbGVtZW50IGlzIGhpZGRlblxuICBpc0hpZGRlbih0aGlzLmVsKSkge1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgdHlwZSA9IHRoaXMudHlwZUNhY2hlW2NsYXNzTmFtZV07XG4gIGlmICh0eXBlKSByZXR1cm4gdHlwZTtcbiAgdmFyIGlubGluZVN0eWxlcyA9IHRoaXMuZWwuc3R5bGU7XG4gIHZhciBjb21wdXRlZFN0eWxlcyA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKHRoaXMuZWwpO1xuICB2YXIgdHJhbnNEdXJhdGlvbiA9IGlubGluZVN0eWxlc1t0cmFuc0R1cmF0aW9uUHJvcF0gfHwgY29tcHV0ZWRTdHlsZXNbdHJhbnNEdXJhdGlvblByb3BdO1xuICBpZiAodHJhbnNEdXJhdGlvbiAmJiB0cmFuc0R1cmF0aW9uICE9PSAnMHMnKSB7XG4gICAgdHlwZSA9IFRZUEVfVFJBTlNJVElPTjtcbiAgfSBlbHNlIHtcbiAgICB2YXIgYW5pbUR1cmF0aW9uID0gaW5saW5lU3R5bGVzW2FuaW1EdXJhdGlvblByb3BdIHx8IGNvbXB1dGVkU3R5bGVzW2FuaW1EdXJhdGlvblByb3BdO1xuICAgIGlmIChhbmltRHVyYXRpb24gJiYgYW5pbUR1cmF0aW9uICE9PSAnMHMnKSB7XG4gICAgICB0eXBlID0gVFlQRV9BTklNQVRJT047XG4gICAgfVxuICB9XG4gIGlmICh0eXBlKSB7XG4gICAgdGhpcy50eXBlQ2FjaGVbY2xhc3NOYW1lXSA9IHR5cGU7XG4gIH1cbiAgcmV0dXJuIHR5cGU7XG59O1xuXG4vKipcbiAqIFNldHVwIGEgQ1NTIHRyYW5zaXRpb25lbmQvYW5pbWF0aW9uZW5kIGNhbGxiYWNrLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2JcbiAqL1xuXG5wJDEuc2V0dXBDc3NDYiA9IGZ1bmN0aW9uIChldmVudCwgY2IpIHtcbiAgdGhpcy5wZW5kaW5nQ3NzRXZlbnQgPSBldmVudDtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgZWwgPSB0aGlzLmVsO1xuICB2YXIgb25FbmQgPSB0aGlzLnBlbmRpbmdDc3NDYiA9IGZ1bmN0aW9uIChlKSB7XG4gICAgaWYgKGUudGFyZ2V0ID09PSBlbCkge1xuICAgICAgb2ZmKGVsLCBldmVudCwgb25FbmQpO1xuICAgICAgc2VsZi5wZW5kaW5nQ3NzRXZlbnQgPSBzZWxmLnBlbmRpbmdDc3NDYiA9IG51bGw7XG4gICAgICBpZiAoIXNlbGYucGVuZGluZ0pzQ2IgJiYgY2IpIHtcbiAgICAgICAgY2IoKTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG4gIG9uJDEoZWwsIGV2ZW50LCBvbkVuZCk7XG59O1xuXG4vKipcbiAqIENoZWNrIGlmIGFuIGVsZW1lbnQgaXMgaGlkZGVuIC0gaW4gdGhhdCBjYXNlIHdlIGNhbiBqdXN0XG4gKiBza2lwIHRoZSB0cmFuc2l0aW9uIGFsbHRvZ2V0aGVyLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cblxuZnVuY3Rpb24gaXNIaWRkZW4oZWwpIHtcbiAgcmV0dXJuICEoZWwub2Zmc2V0V2lkdGggfHwgZWwub2Zmc2V0SGVpZ2h0IHx8IGVsLmdldENsaWVudFJlY3RzKCkubGVuZ3RoKTtcbn1cblxudmFyIHRyYW5zaXRpb24gPSB7XG5cbiAgcHJpb3JpdHk6IFRSQU5TSVRJT04sXG5cbiAgdXBkYXRlOiBmdW5jdGlvbiB1cGRhdGUoaWQsIG9sZElkKSB7XG4gICAgdmFyIGVsID0gdGhpcy5lbDtcbiAgICAvLyByZXNvbHZlIG9uIG93bmVyIHZtXG4gICAgdmFyIGhvb2tzID0gcmVzb2x2ZUFzc2V0KHRoaXMudm0uJG9wdGlvbnMsICd0cmFuc2l0aW9ucycsIGlkKTtcbiAgICBpZCA9IGlkIHx8ICd2JztcbiAgICAvLyBhcHBseSBvbiBjbG9zZXN0IHZtXG4gICAgZWwuX192X3RyYW5zID0gbmV3IFRyYW5zaXRpb24oZWwsIGlkLCBob29rcywgdGhpcy5lbC5fX3Z1ZV9fIHx8IHRoaXMudm0pO1xuICAgIGlmIChvbGRJZCkge1xuICAgICAgcmVtb3ZlQ2xhc3MoZWwsIG9sZElkICsgJy10cmFuc2l0aW9uJyk7XG4gICAgfVxuICAgIGFkZENsYXNzKGVsLCBpZCArICctdHJhbnNpdGlvbicpO1xuICB9XG59O1xuXG52YXIgYmluZGluZ01vZGVzID0gY29uZmlnLl9wcm9wQmluZGluZ01vZGVzO1xuXG52YXIgcHJvcERlZiA9IHtcblxuICBiaW5kOiBmdW5jdGlvbiBiaW5kKCkge1xuXG4gICAgdmFyIGNoaWxkID0gdGhpcy52bTtcbiAgICB2YXIgcGFyZW50ID0gY2hpbGQuX2NvbnRleHQ7XG4gICAgLy8gcGFzc2VkIGluIGZyb20gY29tcGlsZXIgZGlyZWN0bHlcbiAgICB2YXIgcHJvcCA9IHRoaXMuZGVzY3JpcHRvci5wcm9wO1xuICAgIHZhciBjaGlsZEtleSA9IHByb3AucGF0aDtcbiAgICB2YXIgcGFyZW50S2V5ID0gcHJvcC5wYXJlbnRQYXRoO1xuICAgIHZhciB0d29XYXkgPSBwcm9wLm1vZGUgPT09IGJpbmRpbmdNb2Rlcy5UV09fV0FZO1xuXG4gICAgdmFyIHBhcmVudFdhdGNoZXIgPSB0aGlzLnBhcmVudFdhdGNoZXIgPSBuZXcgV2F0Y2hlcihwYXJlbnQsIHBhcmVudEtleSwgZnVuY3Rpb24gKHZhbCkge1xuICAgICAgdmFsID0gY29lcmNlUHJvcChwcm9wLCB2YWwpO1xuICAgICAgaWYgKGFzc2VydFByb3AocHJvcCwgdmFsKSkge1xuICAgICAgICBjaGlsZFtjaGlsZEtleV0gPSB2YWw7XG4gICAgICB9XG4gICAgfSwge1xuICAgICAgdHdvV2F5OiB0d29XYXksXG4gICAgICBmaWx0ZXJzOiBwcm9wLmZpbHRlcnMsXG4gICAgICAvLyBpbXBvcnRhbnQ6IHByb3BzIG5lZWQgdG8gYmUgb2JzZXJ2ZWQgb24gdGhlXG4gICAgICAvLyB2LWZvciBzY29wZSBpZiBwcmVzZW50XG4gICAgICBzY29wZTogdGhpcy5fc2NvcGVcbiAgICB9KTtcblxuICAgIC8vIHNldCB0aGUgY2hpbGQgaW5pdGlhbCB2YWx1ZS5cbiAgICBpbml0UHJvcChjaGlsZCwgcHJvcCwgcGFyZW50V2F0Y2hlci52YWx1ZSk7XG5cbiAgICAvLyBzZXR1cCB0d28td2F5IGJpbmRpbmdcbiAgICBpZiAodHdvV2F5KSB7XG4gICAgICAvLyBpbXBvcnRhbnQ6IGRlZmVyIHRoZSBjaGlsZCB3YXRjaGVyIGNyZWF0aW9uIHVudGlsXG4gICAgICAvLyB0aGUgY3JlYXRlZCBob29rIChhZnRlciBkYXRhIG9ic2VydmF0aW9uKVxuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgY2hpbGQuJG9uY2UoJ3ByZS1ob29rOmNyZWF0ZWQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHNlbGYuY2hpbGRXYXRjaGVyID0gbmV3IFdhdGNoZXIoY2hpbGQsIGNoaWxkS2V5LCBmdW5jdGlvbiAodmFsKSB7XG4gICAgICAgICAgcGFyZW50V2F0Y2hlci5zZXQodmFsKTtcbiAgICAgICAgfSwge1xuICAgICAgICAgIC8vIGVuc3VyZSBzeW5jIHVwd2FyZCBiZWZvcmUgcGFyZW50IHN5bmMgZG93bi5cbiAgICAgICAgICAvLyB0aGlzIGlzIG5lY2Vzc2FyeSBpbiBjYXNlcyBlLmcuIHRoZSBjaGlsZFxuICAgICAgICAgIC8vIG11dGF0ZXMgYSBwcm9wIGFycmF5LCB0aGVuIHJlcGxhY2VzIGl0LiAoIzE2ODMpXG4gICAgICAgICAgc3luYzogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcblxuICB1bmJpbmQ6IGZ1bmN0aW9uIHVuYmluZCgpIHtcbiAgICB0aGlzLnBhcmVudFdhdGNoZXIudGVhcmRvd24oKTtcbiAgICBpZiAodGhpcy5jaGlsZFdhdGNoZXIpIHtcbiAgICAgIHRoaXMuY2hpbGRXYXRjaGVyLnRlYXJkb3duKCk7XG4gICAgfVxuICB9XG59O1xuXG52YXIgY29tcG9uZW50ID0ge1xuXG4gIHByaW9yaXR5OiBDT01QT05FTlQsXG5cbiAgcGFyYW1zOiBbJ2tlZXAtYWxpdmUnLCAndHJhbnNpdGlvbi1tb2RlJywgJ2lubGluZS10ZW1wbGF0ZSddLFxuXG4gIC8qKlxuICAgKiBTZXR1cC4gVHdvIHBvc3NpYmxlIHVzYWdlczpcbiAgICpcbiAgICogLSBzdGF0aWM6XG4gICAqICAgPGNvbXA+IG9yIDxkaXYgdi1jb21wb25lbnQ9XCJjb21wXCI+XG4gICAqXG4gICAqIC0gZHluYW1pYzpcbiAgICogICA8Y29tcG9uZW50IDppcz1cInZpZXdcIj5cbiAgICovXG5cbiAgYmluZDogZnVuY3Rpb24gYmluZCgpIHtcbiAgICBpZiAoIXRoaXMuZWwuX192dWVfXykge1xuICAgICAgLy8ga2VlcC1hbGl2ZSBjYWNoZVxuICAgICAgdGhpcy5rZWVwQWxpdmUgPSB0aGlzLnBhcmFtcy5rZWVwQWxpdmU7XG4gICAgICBpZiAodGhpcy5rZWVwQWxpdmUpIHtcbiAgICAgICAgdGhpcy5jYWNoZSA9IHt9O1xuICAgICAgfVxuICAgICAgLy8gY2hlY2sgaW5saW5lLXRlbXBsYXRlXG4gICAgICBpZiAodGhpcy5wYXJhbXMuaW5saW5lVGVtcGxhdGUpIHtcbiAgICAgICAgLy8gZXh0cmFjdCBpbmxpbmUgdGVtcGxhdGUgYXMgYSBEb2N1bWVudEZyYWdtZW50XG4gICAgICAgIHRoaXMuaW5saW5lVGVtcGxhdGUgPSBleHRyYWN0Q29udGVudCh0aGlzLmVsLCB0cnVlKTtcbiAgICAgIH1cbiAgICAgIC8vIGNvbXBvbmVudCByZXNvbHV0aW9uIHJlbGF0ZWQgc3RhdGVcbiAgICAgIHRoaXMucGVuZGluZ0NvbXBvbmVudENiID0gdGhpcy5Db21wb25lbnQgPSBudWxsO1xuICAgICAgLy8gdHJhbnNpdGlvbiByZWxhdGVkIHN0YXRlXG4gICAgICB0aGlzLnBlbmRpbmdSZW1vdmFscyA9IDA7XG4gICAgICB0aGlzLnBlbmRpbmdSZW1vdmFsQ2IgPSBudWxsO1xuICAgICAgLy8gY3JlYXRlIGEgcmVmIGFuY2hvclxuICAgICAgdGhpcy5hbmNob3IgPSBjcmVhdGVBbmNob3IoJ3YtY29tcG9uZW50Jyk7XG4gICAgICByZXBsYWNlKHRoaXMuZWwsIHRoaXMuYW5jaG9yKTtcbiAgICAgIC8vIHJlbW92ZSBpcyBhdHRyaWJ1dGUuXG4gICAgICAvLyB0aGlzIGlzIHJlbW92ZWQgZHVyaW5nIGNvbXBpbGF0aW9uLCBidXQgYmVjYXVzZSBjb21waWxhdGlvbiBpc1xuICAgICAgLy8gY2FjaGVkLCB3aGVuIHRoZSBjb21wb25lbnQgaXMgdXNlZCBlbHNld2hlcmUgdGhpcyBhdHRyaWJ1dGVcbiAgICAgIC8vIHdpbGwgcmVtYWluIGF0IGxpbmsgdGltZS5cbiAgICAgIHRoaXMuZWwucmVtb3ZlQXR0cmlidXRlKCdpcycpO1xuICAgICAgLy8gcmVtb3ZlIHJlZiwgc2FtZSBhcyBhYm92ZVxuICAgICAgaWYgKHRoaXMuZGVzY3JpcHRvci5yZWYpIHtcbiAgICAgICAgdGhpcy5lbC5yZW1vdmVBdHRyaWJ1dGUoJ3YtcmVmOicgKyBoeXBoZW5hdGUodGhpcy5kZXNjcmlwdG9yLnJlZikpO1xuICAgICAgfVxuICAgICAgLy8gaWYgc3RhdGljLCBidWlsZCByaWdodCBub3cuXG4gICAgICBpZiAodGhpcy5saXRlcmFsKSB7XG4gICAgICAgIHRoaXMuc2V0Q29tcG9uZW50KHRoaXMuZXhwcmVzc2lvbik7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgd2FybignY2Fubm90IG1vdW50IGNvbXBvbmVudCBcIicgKyB0aGlzLmV4cHJlc3Npb24gKyAnXCIgJyArICdvbiBhbHJlYWR5IG1vdW50ZWQgZWxlbWVudDogJyArIHRoaXMuZWwpO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogUHVibGljIHVwZGF0ZSwgY2FsbGVkIGJ5IHRoZSB3YXRjaGVyIGluIHRoZSBkeW5hbWljXG4gICAqIGxpdGVyYWwgc2NlbmFyaW8sIGUuZy4gPGNvbXBvbmVudCA6aXM9XCJ2aWV3XCI+XG4gICAqL1xuXG4gIHVwZGF0ZTogZnVuY3Rpb24gdXBkYXRlKHZhbHVlKSB7XG4gICAgaWYgKCF0aGlzLmxpdGVyYWwpIHtcbiAgICAgIHRoaXMuc2V0Q29tcG9uZW50KHZhbHVlKTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIFN3aXRjaCBkeW5hbWljIGNvbXBvbmVudHMuIE1heSByZXNvbHZlIHRoZSBjb21wb25lbnRcbiAgICogYXN5bmNocm9ub3VzbHksIGFuZCBwZXJmb3JtIHRyYW5zaXRpb24gYmFzZWQgb25cbiAgICogc3BlY2lmaWVkIHRyYW5zaXRpb24gbW9kZS4gQWNjZXB0cyBhIGZldyBhZGRpdGlvbmFsXG4gICAqIGFyZ3VtZW50cyBzcGVjaWZpY2FsbHkgZm9yIHZ1ZS1yb3V0ZXIuXG4gICAqXG4gICAqIFRoZSBjYWxsYmFjayBpcyBjYWxsZWQgd2hlbiB0aGUgZnVsbCB0cmFuc2l0aW9uIGlzXG4gICAqIGZpbmlzaGVkLlxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gdmFsdWVcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NiXVxuICAgKi9cblxuICBzZXRDb21wb25lbnQ6IGZ1bmN0aW9uIHNldENvbXBvbmVudCh2YWx1ZSwgY2IpIHtcbiAgICB0aGlzLmludmFsaWRhdGVQZW5kaW5nKCk7XG4gICAgaWYgKCF2YWx1ZSkge1xuICAgICAgLy8ganVzdCByZW1vdmUgY3VycmVudFxuICAgICAgdGhpcy51bmJ1aWxkKHRydWUpO1xuICAgICAgdGhpcy5yZW1vdmUodGhpcy5jaGlsZFZNLCBjYik7XG4gICAgICB0aGlzLmNoaWxkVk0gPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICB0aGlzLnJlc29sdmVDb21wb25lbnQodmFsdWUsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc2VsZi5tb3VudENvbXBvbmVudChjYik7XG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJlc29sdmUgdGhlIGNvbXBvbmVudCBjb25zdHJ1Y3RvciB0byB1c2Ugd2hlbiBjcmVhdGluZ1xuICAgKiB0aGUgY2hpbGQgdm0uXG4gICAqL1xuXG4gIHJlc29sdmVDb21wb25lbnQ6IGZ1bmN0aW9uIHJlc29sdmVDb21wb25lbnQoaWQsIGNiKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMucGVuZGluZ0NvbXBvbmVudENiID0gY2FuY2VsbGFibGUoZnVuY3Rpb24gKENvbXBvbmVudCkge1xuICAgICAgc2VsZi5Db21wb25lbnROYW1lID0gQ29tcG9uZW50Lm9wdGlvbnMubmFtZSB8fCBpZDtcbiAgICAgIHNlbGYuQ29tcG9uZW50ID0gQ29tcG9uZW50O1xuICAgICAgY2IoKTtcbiAgICB9KTtcbiAgICB0aGlzLnZtLl9yZXNvbHZlQ29tcG9uZW50KGlkLCB0aGlzLnBlbmRpbmdDb21wb25lbnRDYik7XG4gIH0sXG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBpbnN0YW5jZSB1c2luZyB0aGUgY3VycmVudCBjb25zdHJ1Y3RvciBhbmRcbiAgICogcmVwbGFjZSB0aGUgZXhpc3RpbmcgaW5zdGFuY2UuIFRoaXMgbWV0aG9kIGRvZXNuJ3QgY2FyZVxuICAgKiB3aGV0aGVyIHRoZSBuZXcgY29tcG9uZW50IGFuZCB0aGUgb2xkIG9uZSBhcmUgYWN0dWFsbHlcbiAgICogdGhlIHNhbWUuXG4gICAqXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYl1cbiAgICovXG5cbiAgbW91bnRDb21wb25lbnQ6IGZ1bmN0aW9uIG1vdW50Q29tcG9uZW50KGNiKSB7XG4gICAgLy8gYWN0dWFsIG1vdW50XG4gICAgdGhpcy51bmJ1aWxkKHRydWUpO1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgYWN0aXZhdGVIb29rID0gdGhpcy5Db21wb25lbnQub3B0aW9ucy5hY3RpdmF0ZTtcbiAgICB2YXIgY2FjaGVkID0gdGhpcy5nZXRDYWNoZWQoKTtcbiAgICB2YXIgbmV3Q29tcG9uZW50ID0gdGhpcy5idWlsZCgpO1xuICAgIGlmIChhY3RpdmF0ZUhvb2sgJiYgIWNhY2hlZCkge1xuICAgICAgdGhpcy53YWl0aW5nRm9yID0gbmV3Q29tcG9uZW50O1xuICAgICAgYWN0aXZhdGVIb29rLmNhbGwobmV3Q29tcG9uZW50LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChzZWxmLndhaXRpbmdGb3IgIT09IG5ld0NvbXBvbmVudCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBzZWxmLndhaXRpbmdGb3IgPSBudWxsO1xuICAgICAgICBzZWxmLnRyYW5zaXRpb24obmV3Q29tcG9uZW50LCBjYik7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gdXBkYXRlIHJlZiBmb3Iga2VwdC1hbGl2ZSBjb21wb25lbnRcbiAgICAgIGlmIChjYWNoZWQpIHtcbiAgICAgICAgbmV3Q29tcG9uZW50Ll91cGRhdGVSZWYoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMudHJhbnNpdGlvbihuZXdDb21wb25lbnQsIGNiKTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIFdoZW4gdGhlIGNvbXBvbmVudCBjaGFuZ2VzIG9yIHVuYmluZHMgYmVmb3JlIGFuIGFzeW5jXG4gICAqIGNvbnN0cnVjdG9yIGlzIHJlc29sdmVkLCB3ZSBuZWVkIHRvIGludmFsaWRhdGUgaXRzXG4gICAqIHBlbmRpbmcgY2FsbGJhY2suXG4gICAqL1xuXG4gIGludmFsaWRhdGVQZW5kaW5nOiBmdW5jdGlvbiBpbnZhbGlkYXRlUGVuZGluZygpIHtcbiAgICBpZiAodGhpcy5wZW5kaW5nQ29tcG9uZW50Q2IpIHtcbiAgICAgIHRoaXMucGVuZGluZ0NvbXBvbmVudENiLmNhbmNlbCgpO1xuICAgICAgdGhpcy5wZW5kaW5nQ29tcG9uZW50Q2IgPSBudWxsO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogSW5zdGFudGlhdGUvaW5zZXJ0IGEgbmV3IGNoaWxkIHZtLlxuICAgKiBJZiBrZWVwIGFsaXZlIGFuZCBoYXMgY2FjaGVkIGluc3RhbmNlLCBpbnNlcnQgdGhhdFxuICAgKiBpbnN0YW5jZTsgb3RoZXJ3aXNlIGJ1aWxkIGEgbmV3IG9uZSBhbmQgY2FjaGUgaXQuXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbZXh0cmFPcHRpb25zXVxuICAgKiBAcmV0dXJuIHtWdWV9IC0gdGhlIGNyZWF0ZWQgaW5zdGFuY2VcbiAgICovXG5cbiAgYnVpbGQ6IGZ1bmN0aW9uIGJ1aWxkKGV4dHJhT3B0aW9ucykge1xuICAgIHZhciBjYWNoZWQgPSB0aGlzLmdldENhY2hlZCgpO1xuICAgIGlmIChjYWNoZWQpIHtcbiAgICAgIHJldHVybiBjYWNoZWQ7XG4gICAgfVxuICAgIGlmICh0aGlzLkNvbXBvbmVudCkge1xuICAgICAgLy8gZGVmYXVsdCBvcHRpb25zXG4gICAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgICAgbmFtZTogdGhpcy5Db21wb25lbnROYW1lLFxuICAgICAgICBlbDogY2xvbmVOb2RlKHRoaXMuZWwpLFxuICAgICAgICB0ZW1wbGF0ZTogdGhpcy5pbmxpbmVUZW1wbGF0ZSxcbiAgICAgICAgLy8gbWFrZSBzdXJlIHRvIGFkZCB0aGUgY2hpbGQgd2l0aCBjb3JyZWN0IHBhcmVudFxuICAgICAgICAvLyBpZiB0aGlzIGlzIGEgdHJhbnNjbHVkZWQgY29tcG9uZW50LCBpdHMgcGFyZW50XG4gICAgICAgIC8vIHNob3VsZCBiZSB0aGUgdHJhbnNjbHVzaW9uIGhvc3QuXG4gICAgICAgIHBhcmVudDogdGhpcy5faG9zdCB8fCB0aGlzLnZtLFxuICAgICAgICAvLyBpZiBubyBpbmxpbmUtdGVtcGxhdGUsIHRoZW4gdGhlIGNvbXBpbGVkXG4gICAgICAgIC8vIGxpbmtlciBjYW4gYmUgY2FjaGVkIGZvciBiZXR0ZXIgcGVyZm9ybWFuY2UuXG4gICAgICAgIF9saW5rZXJDYWNoYWJsZTogIXRoaXMuaW5saW5lVGVtcGxhdGUsXG4gICAgICAgIF9yZWY6IHRoaXMuZGVzY3JpcHRvci5yZWYsXG4gICAgICAgIF9hc0NvbXBvbmVudDogdHJ1ZSxcbiAgICAgICAgX2lzUm91dGVyVmlldzogdGhpcy5faXNSb3V0ZXJWaWV3LFxuICAgICAgICAvLyBpZiB0aGlzIGlzIGEgdHJhbnNjbHVkZWQgY29tcG9uZW50LCBjb250ZXh0XG4gICAgICAgIC8vIHdpbGwgYmUgdGhlIGNvbW1vbiBwYXJlbnQgdm0gb2YgdGhpcyBpbnN0YW5jZVxuICAgICAgICAvLyBhbmQgaXRzIGhvc3QuXG4gICAgICAgIF9jb250ZXh0OiB0aGlzLnZtLFxuICAgICAgICAvLyBpZiB0aGlzIGlzIGluc2lkZSBhbiBpbmxpbmUgdi1mb3IsIHRoZSBzY29wZVxuICAgICAgICAvLyB3aWxsIGJlIHRoZSBpbnRlcm1lZGlhdGUgc2NvcGUgY3JlYXRlZCBmb3IgdGhpc1xuICAgICAgICAvLyByZXBlYXQgZnJhZ21lbnQuIHRoaXMgaXMgdXNlZCBmb3IgbGlua2luZyBwcm9wc1xuICAgICAgICAvLyBhbmQgY29udGFpbmVyIGRpcmVjdGl2ZXMuXG4gICAgICAgIF9zY29wZTogdGhpcy5fc2NvcGUsXG4gICAgICAgIC8vIHBhc3MgaW4gdGhlIG93bmVyIGZyYWdtZW50IG9mIHRoaXMgY29tcG9uZW50LlxuICAgICAgICAvLyB0aGlzIGlzIG5lY2Vzc2FyeSBzbyB0aGF0IHRoZSBmcmFnbWVudCBjYW4ga2VlcFxuICAgICAgICAvLyB0cmFjayBvZiBpdHMgY29udGFpbmVkIGNvbXBvbmVudHMgaW4gb3JkZXIgdG9cbiAgICAgICAgLy8gY2FsbCBhdHRhY2gvZGV0YWNoIGhvb2tzIGZvciB0aGVtLlxuICAgICAgICBfZnJhZzogdGhpcy5fZnJhZ1xuICAgICAgfTtcbiAgICAgIC8vIGV4dHJhIG9wdGlvbnNcbiAgICAgIC8vIGluIDEuMC4wIHRoaXMgaXMgdXNlZCBieSB2dWUtcm91dGVyIG9ubHlcbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgaWYgKGV4dHJhT3B0aW9ucykge1xuICAgICAgICBleHRlbmQob3B0aW9ucywgZXh0cmFPcHRpb25zKTtcbiAgICAgIH1cbiAgICAgIHZhciBjaGlsZCA9IG5ldyB0aGlzLkNvbXBvbmVudChvcHRpb25zKTtcbiAgICAgIGlmICh0aGlzLmtlZXBBbGl2ZSkge1xuICAgICAgICB0aGlzLmNhY2hlW3RoaXMuQ29tcG9uZW50LmNpZF0gPSBjaGlsZDtcbiAgICAgIH1cbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgdGhpcy5lbC5oYXNBdHRyaWJ1dGUoJ3RyYW5zaXRpb24nKSAmJiBjaGlsZC5faXNGcmFnbWVudCkge1xuICAgICAgICB3YXJuKCdUcmFuc2l0aW9ucyB3aWxsIG5vdCB3b3JrIG9uIGEgZnJhZ21lbnQgaW5zdGFuY2UuICcgKyAnVGVtcGxhdGU6ICcgKyBjaGlsZC4kb3B0aW9ucy50ZW1wbGF0ZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gY2hpbGQ7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBUcnkgdG8gZ2V0IGEgY2FjaGVkIGluc3RhbmNlIG9mIHRoZSBjdXJyZW50IGNvbXBvbmVudC5cbiAgICpcbiAgICogQHJldHVybiB7VnVlfHVuZGVmaW5lZH1cbiAgICovXG5cbiAgZ2V0Q2FjaGVkOiBmdW5jdGlvbiBnZXRDYWNoZWQoKSB7XG4gICAgcmV0dXJuIHRoaXMua2VlcEFsaXZlICYmIHRoaXMuY2FjaGVbdGhpcy5Db21wb25lbnQuY2lkXTtcbiAgfSxcblxuICAvKipcbiAgICogVGVhcmRvd24gdGhlIGN1cnJlbnQgY2hpbGQsIGJ1dCBkZWZlcnMgY2xlYW51cCBzb1xuICAgKiB0aGF0IHdlIGNhbiBzZXBhcmF0ZSB0aGUgZGVzdHJveSBhbmQgcmVtb3ZhbCBzdGVwcy5cbiAgICpcbiAgICogQHBhcmFtIHtCb29sZWFufSBkZWZlclxuICAgKi9cblxuICB1bmJ1aWxkOiBmdW5jdGlvbiB1bmJ1aWxkKGRlZmVyKSB7XG4gICAgaWYgKHRoaXMud2FpdGluZ0Zvcikge1xuICAgICAgdGhpcy53YWl0aW5nRm9yLiRkZXN0cm95KCk7XG4gICAgICB0aGlzLndhaXRpbmdGb3IgPSBudWxsO1xuICAgIH1cbiAgICB2YXIgY2hpbGQgPSB0aGlzLmNoaWxkVk07XG4gICAgaWYgKCFjaGlsZCB8fCB0aGlzLmtlZXBBbGl2ZSkge1xuICAgICAgaWYgKGNoaWxkKSB7XG4gICAgICAgIC8vIHJlbW92ZSByZWZcbiAgICAgICAgY2hpbGQuX3VwZGF0ZVJlZih0cnVlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gdGhlIHNvbGUgcHVycG9zZSBvZiBgZGVmZXJDbGVhbnVwYCBpcyBzbyB0aGF0IHdlIGNhblxuICAgIC8vIFwiZGVhY3RpdmF0ZVwiIHRoZSB2bSByaWdodCBub3cgYW5kIHBlcmZvcm0gRE9NIHJlbW92YWxcbiAgICAvLyBsYXRlci5cbiAgICBjaGlsZC4kZGVzdHJveShmYWxzZSwgZGVmZXIpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBSZW1vdmUgY3VycmVudCBkZXN0cm95ZWQgY2hpbGQgYW5kIG1hbnVhbGx5IGRvXG4gICAqIHRoZSBjbGVhbnVwIGFmdGVyIHJlbW92YWwuXG4gICAqXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNiXG4gICAqL1xuXG4gIHJlbW92ZTogZnVuY3Rpb24gcmVtb3ZlKGNoaWxkLCBjYikge1xuICAgIHZhciBrZWVwQWxpdmUgPSB0aGlzLmtlZXBBbGl2ZTtcbiAgICBpZiAoY2hpbGQpIHtcbiAgICAgIC8vIHdlIG1heSBoYXZlIGEgY29tcG9uZW50IHN3aXRjaCB3aGVuIGEgcHJldmlvdXNcbiAgICAgIC8vIGNvbXBvbmVudCBpcyBzdGlsbCBiZWluZyB0cmFuc2l0aW9uZWQgb3V0LlxuICAgICAgLy8gd2Ugd2FudCB0byB0cmlnZ2VyIG9ubHkgb25lIGxhc3Rlc3QgaW5zZXJ0aW9uIGNiXG4gICAgICAvLyB3aGVuIHRoZSBleGlzdGluZyB0cmFuc2l0aW9uIGZpbmlzaGVzLiAoIzExMTkpXG4gICAgICB0aGlzLnBlbmRpbmdSZW1vdmFscysrO1xuICAgICAgdGhpcy5wZW5kaW5nUmVtb3ZhbENiID0gY2I7XG4gICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICBjaGlsZC4kcmVtb3ZlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc2VsZi5wZW5kaW5nUmVtb3ZhbHMtLTtcbiAgICAgICAgaWYgKCFrZWVwQWxpdmUpIGNoaWxkLl9jbGVhbnVwKCk7XG4gICAgICAgIGlmICghc2VsZi5wZW5kaW5nUmVtb3ZhbHMgJiYgc2VsZi5wZW5kaW5nUmVtb3ZhbENiKSB7XG4gICAgICAgICAgc2VsZi5wZW5kaW5nUmVtb3ZhbENiKCk7XG4gICAgICAgICAgc2VsZi5wZW5kaW5nUmVtb3ZhbENiID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmIChjYikge1xuICAgICAgY2IoKTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIEFjdHVhbGx5IHN3YXAgdGhlIGNvbXBvbmVudHMsIGRlcGVuZGluZyBvbiB0aGVcbiAgICogdHJhbnNpdGlvbiBtb2RlLiBEZWZhdWx0cyB0byBzaW11bHRhbmVvdXMuXG4gICAqXG4gICAqIEBwYXJhbSB7VnVlfSB0YXJnZXRcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NiXVxuICAgKi9cblxuICB0cmFuc2l0aW9uOiBmdW5jdGlvbiB0cmFuc2l0aW9uKHRhcmdldCwgY2IpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGN1cnJlbnQgPSB0aGlzLmNoaWxkVk07XG4gICAgLy8gZm9yIGRldnRvb2wgaW5zcGVjdGlvblxuICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICBpZiAoY3VycmVudCkgY3VycmVudC5faW5hY3RpdmUgPSB0cnVlO1xuICAgICAgdGFyZ2V0Ll9pbmFjdGl2ZSA9IGZhbHNlO1xuICAgIH1cbiAgICB0aGlzLmNoaWxkVk0gPSB0YXJnZXQ7XG4gICAgc3dpdGNoIChzZWxmLnBhcmFtcy50cmFuc2l0aW9uTW9kZSkge1xuICAgICAgY2FzZSAnaW4tb3V0JzpcbiAgICAgICAgdGFyZ2V0LiRiZWZvcmUoc2VsZi5hbmNob3IsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBzZWxmLnJlbW92ZShjdXJyZW50LCBjYik7XG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ291dC1pbic6XG4gICAgICAgIHNlbGYucmVtb3ZlKGN1cnJlbnQsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICB0YXJnZXQuJGJlZm9yZShzZWxmLmFuY2hvciwgY2IpO1xuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBzZWxmLnJlbW92ZShjdXJyZW50KTtcbiAgICAgICAgdGFyZ2V0LiRiZWZvcmUoc2VsZi5hbmNob3IsIGNiKTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIFVuYmluZC5cbiAgICovXG5cbiAgdW5iaW5kOiBmdW5jdGlvbiB1bmJpbmQoKSB7XG4gICAgdGhpcy5pbnZhbGlkYXRlUGVuZGluZygpO1xuICAgIC8vIERvIG5vdCBkZWZlciBjbGVhbnVwIHdoZW4gdW5iaW5kaW5nXG4gICAgdGhpcy51bmJ1aWxkKCk7XG4gICAgLy8gZGVzdHJveSBhbGwga2VlcC1hbGl2ZSBjYWNoZWQgaW5zdGFuY2VzXG4gICAgaWYgKHRoaXMuY2FjaGUpIHtcbiAgICAgIGZvciAodmFyIGtleSBpbiB0aGlzLmNhY2hlKSB7XG4gICAgICAgIHRoaXMuY2FjaGVba2V5XS4kZGVzdHJveSgpO1xuICAgICAgfVxuICAgICAgdGhpcy5jYWNoZSA9IG51bGw7XG4gICAgfVxuICB9XG59O1xuXG52YXIgdkNsYXNzID0ge1xuXG4gIGRlZXA6IHRydWUsXG5cbiAgdXBkYXRlOiBmdW5jdGlvbiB1cGRhdGUodmFsdWUpIHtcbiAgICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgdGhpcy5oYW5kbGVPYmplY3Qoc3RyaW5nVG9PYmplY3QodmFsdWUpKTtcbiAgICB9IGVsc2UgaWYgKGlzUGxhaW5PYmplY3QodmFsdWUpKSB7XG4gICAgICB0aGlzLmhhbmRsZU9iamVjdCh2YWx1ZSk7XG4gICAgfSBlbHNlIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgICAgdGhpcy5oYW5kbGVBcnJheSh2YWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuY2xlYW51cCgpO1xuICAgIH1cbiAgfSxcblxuICBoYW5kbGVPYmplY3Q6IGZ1bmN0aW9uIGhhbmRsZU9iamVjdCh2YWx1ZSkge1xuICAgIHRoaXMuY2xlYW51cCh2YWx1ZSk7XG4gICAgdmFyIGtleXMgPSB0aGlzLnByZXZLZXlzID0gT2JqZWN0LmtleXModmFsdWUpO1xuICAgIGZvciAodmFyIGkgPSAwLCBsID0ga2V5cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIHZhciBrZXkgPSBrZXlzW2ldO1xuICAgICAgaWYgKHZhbHVlW2tleV0pIHtcbiAgICAgICAgYWRkQ2xhc3ModGhpcy5lbCwga2V5KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlbW92ZUNsYXNzKHRoaXMuZWwsIGtleSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIGhhbmRsZUFycmF5OiBmdW5jdGlvbiBoYW5kbGVBcnJheSh2YWx1ZSkge1xuICAgIHRoaXMuY2xlYW51cCh2YWx1ZSk7XG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSB2YWx1ZS5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIGlmICh2YWx1ZVtpXSkge1xuICAgICAgICBhZGRDbGFzcyh0aGlzLmVsLCB2YWx1ZVtpXSk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMucHJldktleXMgPSB2YWx1ZS5zbGljZSgpO1xuICB9LFxuXG4gIGNsZWFudXA6IGZ1bmN0aW9uIGNsZWFudXAodmFsdWUpIHtcbiAgICBpZiAodGhpcy5wcmV2S2V5cykge1xuICAgICAgdmFyIGkgPSB0aGlzLnByZXZLZXlzLmxlbmd0aDtcbiAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgdmFyIGtleSA9IHRoaXMucHJldktleXNbaV07XG4gICAgICAgIGlmIChrZXkgJiYgKCF2YWx1ZSB8fCAhY29udGFpbnMkMSh2YWx1ZSwga2V5KSkpIHtcbiAgICAgICAgICByZW1vdmVDbGFzcyh0aGlzLmVsLCBrZXkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59O1xuXG5mdW5jdGlvbiBzdHJpbmdUb09iamVjdCh2YWx1ZSkge1xuICB2YXIgcmVzID0ge307XG4gIHZhciBrZXlzID0gdmFsdWUudHJpbSgpLnNwbGl0KC9cXHMrLyk7XG4gIHZhciBpID0ga2V5cy5sZW5ndGg7XG4gIHdoaWxlIChpLS0pIHtcbiAgICByZXNba2V5c1tpXV0gPSB0cnVlO1xuICB9XG4gIHJldHVybiByZXM7XG59XG5cbmZ1bmN0aW9uIGNvbnRhaW5zJDEodmFsdWUsIGtleSkge1xuICByZXR1cm4gaXNBcnJheSh2YWx1ZSkgPyB2YWx1ZS5pbmRleE9mKGtleSkgPiAtMSA6IGhhc093bih2YWx1ZSwga2V5KTtcbn1cblxudmFyIGludGVybmFsRGlyZWN0aXZlcyA9IHtcbiAgc3R5bGU6IHN0eWxlLFxuICAnY2xhc3MnOiB2Q2xhc3MsXG4gIGNvbXBvbmVudDogY29tcG9uZW50LFxuICBwcm9wOiBwcm9wRGVmLFxuICB0cmFuc2l0aW9uOiB0cmFuc2l0aW9uXG59O1xuXG52YXIgcHJvcEJpbmRpbmdNb2RlcyA9IGNvbmZpZy5fcHJvcEJpbmRpbmdNb2RlcztcbnZhciBlbXB0eSA9IHt9O1xuXG4vLyByZWdleGVzXG52YXIgaWRlbnRSRSQxID0gL15bJF9hLXpBLVpdK1tcXHckXSokLztcbnZhciBzZXR0YWJsZVBhdGhSRSA9IC9eW0EtWmEtel8kXVtcXHckXSooXFwuW0EtWmEtel8kXVtcXHckXSp8XFxbW15cXFtcXF1dK1xcXSkqJC87XG5cbi8qKlxuICogQ29tcGlsZSBwcm9wcyBvbiBhIHJvb3QgZWxlbWVudCBhbmQgcmV0dXJuXG4gKiBhIHByb3BzIGxpbmsgZnVuY3Rpb24uXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fERvY3VtZW50RnJhZ21lbnR9IGVsXG4gKiBAcGFyYW0ge0FycmF5fSBwcm9wT3B0aW9uc1xuICogQHJldHVybiB7RnVuY3Rpb259IHByb3BzTGlua0ZuXG4gKi9cblxuZnVuY3Rpb24gY29tcGlsZVByb3BzKGVsLCBwcm9wT3B0aW9ucykge1xuICB2YXIgcHJvcHMgPSBbXTtcbiAgdmFyIG5hbWVzID0gT2JqZWN0LmtleXMocHJvcE9wdGlvbnMpO1xuICB2YXIgaSA9IG5hbWVzLmxlbmd0aDtcbiAgdmFyIG9wdGlvbnMsIG5hbWUsIGF0dHIsIHZhbHVlLCBwYXRoLCBwYXJzZWQsIHByb3A7XG4gIHdoaWxlIChpLS0pIHtcbiAgICBuYW1lID0gbmFtZXNbaV07XG4gICAgb3B0aW9ucyA9IHByb3BPcHRpb25zW25hbWVdIHx8IGVtcHR5O1xuXG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgbmFtZSA9PT0gJyRkYXRhJykge1xuICAgICAgd2FybignRG8gbm90IHVzZSAkZGF0YSBhcyBwcm9wLicpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gcHJvcHMgY291bGQgY29udGFpbiBkYXNoZXMsIHdoaWNoIHdpbGwgYmVcbiAgICAvLyBpbnRlcnByZXRlZCBhcyBtaW51cyBjYWxjdWxhdGlvbnMgYnkgdGhlIHBhcnNlclxuICAgIC8vIHNvIHdlIG5lZWQgdG8gY2FtZWxpemUgdGhlIHBhdGggaGVyZVxuICAgIHBhdGggPSBjYW1lbGl6ZShuYW1lKTtcbiAgICBpZiAoIWlkZW50UkUkMS50ZXN0KHBhdGgpKSB7XG4gICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHdhcm4oJ0ludmFsaWQgcHJvcCBrZXk6IFwiJyArIG5hbWUgKyAnXCIuIFByb3Aga2V5cyAnICsgJ211c3QgYmUgdmFsaWQgaWRlbnRpZmllcnMuJyk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBwcm9wID0ge1xuICAgICAgbmFtZTogbmFtZSxcbiAgICAgIHBhdGg6IHBhdGgsXG4gICAgICBvcHRpb25zOiBvcHRpb25zLFxuICAgICAgbW9kZTogcHJvcEJpbmRpbmdNb2Rlcy5PTkVfV0FZLFxuICAgICAgcmF3OiBudWxsXG4gICAgfTtcblxuICAgIGF0dHIgPSBoeXBoZW5hdGUobmFtZSk7XG4gICAgLy8gZmlyc3QgY2hlY2sgZHluYW1pYyB2ZXJzaW9uXG4gICAgaWYgKCh2YWx1ZSA9IGdldEJpbmRBdHRyKGVsLCBhdHRyKSkgPT09IG51bGwpIHtcbiAgICAgIGlmICgodmFsdWUgPSBnZXRCaW5kQXR0cihlbCwgYXR0ciArICcuc3luYycpKSAhPT0gbnVsbCkge1xuICAgICAgICBwcm9wLm1vZGUgPSBwcm9wQmluZGluZ01vZGVzLlRXT19XQVk7XG4gICAgICB9IGVsc2UgaWYgKCh2YWx1ZSA9IGdldEJpbmRBdHRyKGVsLCBhdHRyICsgJy5vbmNlJykpICE9PSBudWxsKSB7XG4gICAgICAgIHByb3AubW9kZSA9IHByb3BCaW5kaW5nTW9kZXMuT05FX1RJTUU7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh2YWx1ZSAhPT0gbnVsbCkge1xuICAgICAgLy8gaGFzIGR5bmFtaWMgYmluZGluZyFcbiAgICAgIHByb3AucmF3ID0gdmFsdWU7XG4gICAgICBwYXJzZWQgPSBwYXJzZURpcmVjdGl2ZSh2YWx1ZSk7XG4gICAgICB2YWx1ZSA9IHBhcnNlZC5leHByZXNzaW9uO1xuICAgICAgcHJvcC5maWx0ZXJzID0gcGFyc2VkLmZpbHRlcnM7XG4gICAgICAvLyBjaGVjayBiaW5kaW5nIHR5cGVcbiAgICAgIGlmIChpc0xpdGVyYWwodmFsdWUpKSB7XG4gICAgICAgIC8vIGZvciBleHByZXNzaW9ucyBjb250YWluaW5nIGxpdGVyYWwgbnVtYmVycyBhbmRcbiAgICAgICAgLy8gYm9vbGVhbnMsIHRoZXJlJ3Mgbm8gbmVlZCB0byBzZXR1cCBhIHByb3AgYmluZGluZyxcbiAgICAgICAgLy8gc28gd2UgY2FuIG9wdGltaXplIHRoZW0gYXMgYSBvbmUtdGltZSBzZXQuXG4gICAgICAgIHByb3Aub3B0aW1pemVkTGl0ZXJhbCA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwcm9wLmR5bmFtaWMgPSB0cnVlO1xuICAgICAgICAvLyBjaGVjayBub24tc2V0dGFibGUgcGF0aCBmb3IgdHdvLXdheSBiaW5kaW5nc1xuICAgICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBwcm9wLm1vZGUgPT09IHByb3BCaW5kaW5nTW9kZXMuVFdPX1dBWSAmJiAhc2V0dGFibGVQYXRoUkUudGVzdCh2YWx1ZSkpIHtcbiAgICAgICAgICBwcm9wLm1vZGUgPSBwcm9wQmluZGluZ01vZGVzLk9ORV9XQVk7XG4gICAgICAgICAgd2FybignQ2Fubm90IGJpbmQgdHdvLXdheSBwcm9wIHdpdGggbm9uLXNldHRhYmxlICcgKyAncGFyZW50IHBhdGg6ICcgKyB2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHByb3AucGFyZW50UGF0aCA9IHZhbHVlO1xuXG4gICAgICAvLyB3YXJuIHJlcXVpcmVkIHR3by13YXlcbiAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIG9wdGlvbnMudHdvV2F5ICYmIHByb3AubW9kZSAhPT0gcHJvcEJpbmRpbmdNb2Rlcy5UV09fV0FZKSB7XG4gICAgICAgIHdhcm4oJ1Byb3AgXCInICsgbmFtZSArICdcIiBleHBlY3RzIGEgdHdvLXdheSBiaW5kaW5nIHR5cGUuJyk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICgodmFsdWUgPSBnZXRBdHRyKGVsLCBhdHRyKSkgIT09IG51bGwpIHtcbiAgICAgIC8vIGhhcyBsaXRlcmFsIGJpbmRpbmchXG4gICAgICBwcm9wLnJhdyA9IHZhbHVlO1xuICAgIH0gZWxzZSBpZiAob3B0aW9ucy5yZXF1aXJlZCkge1xuICAgICAgLy8gd2FybiBtaXNzaW5nIHJlcXVpcmVkXG4gICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHdhcm4oJ01pc3NpbmcgcmVxdWlyZWQgcHJvcDogJyArIG5hbWUpO1xuICAgIH1cbiAgICAvLyBwdXNoIHByb3BcbiAgICBwcm9wcy5wdXNoKHByb3ApO1xuICB9XG4gIHJldHVybiBtYWtlUHJvcHNMaW5rRm4ocHJvcHMpO1xufVxuXG4vKipcbiAqIEJ1aWxkIGEgZnVuY3Rpb24gdGhhdCBhcHBsaWVzIHByb3BzIHRvIGEgdm0uXG4gKlxuICogQHBhcmFtIHtBcnJheX0gcHJvcHNcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufSBwcm9wc0xpbmtGblxuICovXG5cbmZ1bmN0aW9uIG1ha2VQcm9wc0xpbmtGbihwcm9wcykge1xuICByZXR1cm4gZnVuY3Rpb24gcHJvcHNMaW5rRm4odm0sIHNjb3BlKSB7XG4gICAgLy8gc3RvcmUgcmVzb2x2ZWQgcHJvcHMgaW5mb1xuICAgIHZtLl9wcm9wcyA9IHt9O1xuICAgIHZhciBpID0gcHJvcHMubGVuZ3RoO1xuICAgIHZhciBwcm9wLCBwYXRoLCBvcHRpb25zLCB2YWx1ZSwgcmF3O1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIHByb3AgPSBwcm9wc1tpXTtcbiAgICAgIHJhdyA9IHByb3AucmF3O1xuICAgICAgcGF0aCA9IHByb3AucGF0aDtcbiAgICAgIG9wdGlvbnMgPSBwcm9wLm9wdGlvbnM7XG4gICAgICB2bS5fcHJvcHNbcGF0aF0gPSBwcm9wO1xuICAgICAgaWYgKHJhdyA9PT0gbnVsbCkge1xuICAgICAgICAvLyBpbml0aWFsaXplIGFic2VudCBwcm9wXG4gICAgICAgIGluaXRQcm9wKHZtLCBwcm9wLCBnZXREZWZhdWx0KHZtLCBvcHRpb25zKSk7XG4gICAgICB9IGVsc2UgaWYgKHByb3AuZHluYW1pYykge1xuICAgICAgICAvLyBkeW5hbWljIHByb3BcbiAgICAgICAgaWYgKHZtLl9jb250ZXh0KSB7XG4gICAgICAgICAgaWYgKHByb3AubW9kZSA9PT0gcHJvcEJpbmRpbmdNb2Rlcy5PTkVfVElNRSkge1xuICAgICAgICAgICAgLy8gb25lIHRpbWUgYmluZGluZ1xuICAgICAgICAgICAgdmFsdWUgPSAoc2NvcGUgfHwgdm0uX2NvbnRleHQpLiRnZXQocHJvcC5wYXJlbnRQYXRoKTtcbiAgICAgICAgICAgIGluaXRQcm9wKHZtLCBwcm9wLCB2YWx1ZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGR5bmFtaWMgYmluZGluZ1xuICAgICAgICAgICAgdm0uX2JpbmREaXIoe1xuICAgICAgICAgICAgICBuYW1lOiAncHJvcCcsXG4gICAgICAgICAgICAgIGRlZjogcHJvcERlZixcbiAgICAgICAgICAgICAgcHJvcDogcHJvcFxuICAgICAgICAgICAgfSwgbnVsbCwgbnVsbCwgc2NvcGUpOyAvLyBlbCwgaG9zdCwgc2NvcGVcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHdhcm4oJ0Nhbm5vdCBiaW5kIGR5bmFtaWMgcHJvcCBvbiBhIHJvb3QgaW5zdGFuY2UnICsgJyB3aXRoIG5vIHBhcmVudDogJyArIHByb3AubmFtZSArICc9XCInICsgcmF3ICsgJ1wiJyk7XG4gICAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChwcm9wLm9wdGltaXplZExpdGVyYWwpIHtcbiAgICAgICAgLy8gb3B0aW1pemVkIGxpdGVyYWwsIGNhc3QgaXQgYW5kIGp1c3Qgc2V0IG9uY2VcbiAgICAgICAgdmFyIHN0cmlwcGVkID0gc3RyaXBRdW90ZXMocmF3KTtcbiAgICAgICAgdmFsdWUgPSBzdHJpcHBlZCA9PT0gcmF3ID8gdG9Cb29sZWFuKHRvTnVtYmVyKHJhdykpIDogc3RyaXBwZWQ7XG4gICAgICAgIGluaXRQcm9wKHZtLCBwcm9wLCB2YWx1ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBzdHJpbmcgbGl0ZXJhbCwgYnV0IHdlIG5lZWQgdG8gY2F0ZXIgZm9yXG4gICAgICAgIC8vIEJvb2xlYW4gcHJvcHMgd2l0aCBubyB2YWx1ZVxuICAgICAgICB2YWx1ZSA9IG9wdGlvbnMudHlwZSA9PT0gQm9vbGVhbiAmJiByYXcgPT09ICcnID8gdHJ1ZSA6IHJhdztcbiAgICAgICAgaW5pdFByb3Aodm0sIHByb3AsIHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG59XG5cbi8qKlxuICogR2V0IHRoZSBkZWZhdWx0IHZhbHVlIG9mIGEgcHJvcC5cbiAqXG4gKiBAcGFyYW0ge1Z1ZX0gdm1cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHsqfVxuICovXG5cbmZ1bmN0aW9uIGdldERlZmF1bHQodm0sIG9wdGlvbnMpIHtcbiAgLy8gbm8gZGVmYXVsdCwgcmV0dXJuIHVuZGVmaW5lZFxuICBpZiAoIWhhc093bihvcHRpb25zLCAnZGVmYXVsdCcpKSB7XG4gICAgLy8gYWJzZW50IGJvb2xlYW4gdmFsdWUgZGVmYXVsdHMgdG8gZmFsc2VcbiAgICByZXR1cm4gb3B0aW9ucy50eXBlID09PSBCb29sZWFuID8gZmFsc2UgOiB1bmRlZmluZWQ7XG4gIH1cbiAgdmFyIGRlZiA9IG9wdGlvbnNbJ2RlZmF1bHQnXTtcbiAgLy8gd2FybiBhZ2FpbnN0IG5vbi1mYWN0b3J5IGRlZmF1bHRzIGZvciBPYmplY3QgJiBBcnJheVxuICBpZiAoaXNPYmplY3QoZGVmKSkge1xuICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgd2FybignT2JqZWN0L0FycmF5IGFzIGRlZmF1bHQgcHJvcCB2YWx1ZXMgd2lsbCBiZSBzaGFyZWQgJyArICdhY3Jvc3MgbXVsdGlwbGUgaW5zdGFuY2VzLiBVc2UgYSBmYWN0b3J5IGZ1bmN0aW9uICcgKyAndG8gcmV0dXJuIHRoZSBkZWZhdWx0IHZhbHVlIGluc3RlYWQuJyk7XG4gIH1cbiAgLy8gY2FsbCBmYWN0b3J5IGZ1bmN0aW9uIGZvciBub24tRnVuY3Rpb24gdHlwZXNcbiAgcmV0dXJuIHR5cGVvZiBkZWYgPT09ICdmdW5jdGlvbicgJiYgb3B0aW9ucy50eXBlICE9PSBGdW5jdGlvbiA/IGRlZi5jYWxsKHZtKSA6IGRlZjtcbn1cblxuLy8gc3BlY2lhbCBiaW5kaW5nIHByZWZpeGVzXG52YXIgYmluZFJFID0gL152LWJpbmQ6fF46LztcbnZhciBvblJFID0gL152LW9uOnxeQC87XG52YXIgYXJnUkUgPSAvOiguKikkLztcbnZhciBtb2RpZmllclJFID0gL1xcLlteXFwuXSsvZztcbnZhciB0cmFuc2l0aW9uUkUgPSAvXih2LWJpbmQ6fDopP3RyYW5zaXRpb24kLztcblxuLy8gdGVybWluYWwgZGlyZWN0aXZlc1xudmFyIHRlcm1pbmFsRGlyZWN0aXZlcyA9IFsnZm9yJywgJ2lmJ107XG5cbi8vIGRlZmF1bHQgZGlyZWN0aXZlIHByaW9yaXR5XG52YXIgREVGQVVMVF9QUklPUklUWSA9IDEwMDA7XG5cbi8qKlxuICogQ29tcGlsZSBhIHRlbXBsYXRlIGFuZCByZXR1cm4gYSByZXVzYWJsZSBjb21wb3NpdGUgbGlua1xuICogZnVuY3Rpb24sIHdoaWNoIHJlY3Vyc2l2ZWx5IGNvbnRhaW5zIG1vcmUgbGluayBmdW5jdGlvbnNcbiAqIGluc2lkZS4gVGhpcyB0b3AgbGV2ZWwgY29tcGlsZSBmdW5jdGlvbiB3b3VsZCBub3JtYWxseVxuICogYmUgY2FsbGVkIG9uIGluc3RhbmNlIHJvb3Qgbm9kZXMsIGJ1dCBjYW4gYWxzbyBiZSB1c2VkXG4gKiBmb3IgcGFydGlhbCBjb21waWxhdGlvbiBpZiB0aGUgcGFydGlhbCBhcmd1bWVudCBpcyB0cnVlLlxuICpcbiAqIFRoZSByZXR1cm5lZCBjb21wb3NpdGUgbGluayBmdW5jdGlvbiwgd2hlbiBjYWxsZWQsIHdpbGxcbiAqIHJldHVybiBhbiB1bmxpbmsgZnVuY3Rpb24gdGhhdCB0ZWFyc2Rvd24gYWxsIGRpcmVjdGl2ZXNcbiAqIGNyZWF0ZWQgZHVyaW5nIHRoZSBsaW5raW5nIHBoYXNlLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudHxEb2N1bWVudEZyYWdtZW50fSBlbFxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gcGFydGlhbFxuICogQHJldHVybiB7RnVuY3Rpb259XG4gKi9cblxuZnVuY3Rpb24gY29tcGlsZShlbCwgb3B0aW9ucywgcGFydGlhbCkge1xuICAvLyBsaW5rIGZ1bmN0aW9uIGZvciB0aGUgbm9kZSBpdHNlbGYuXG4gIHZhciBub2RlTGlua0ZuID0gcGFydGlhbCB8fCAhb3B0aW9ucy5fYXNDb21wb25lbnQgPyBjb21waWxlTm9kZShlbCwgb3B0aW9ucykgOiBudWxsO1xuICAvLyBsaW5rIGZ1bmN0aW9uIGZvciB0aGUgY2hpbGROb2Rlc1xuICB2YXIgY2hpbGRMaW5rRm4gPSAhKG5vZGVMaW5rRm4gJiYgbm9kZUxpbmtGbi50ZXJtaW5hbCkgJiYgZWwudGFnTmFtZSAhPT0gJ1NDUklQVCcgJiYgZWwuaGFzQ2hpbGROb2RlcygpID8gY29tcGlsZU5vZGVMaXN0KGVsLmNoaWxkTm9kZXMsIG9wdGlvbnMpIDogbnVsbDtcblxuICAvKipcbiAgICogQSBjb21wb3NpdGUgbGlua2VyIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBvbiBhIGFscmVhZHlcbiAgICogY29tcGlsZWQgcGllY2Ugb2YgRE9NLCB3aGljaCBpbnN0YW50aWF0ZXMgYWxsIGRpcmVjdGl2ZVxuICAgKiBpbnN0YW5jZXMuXG4gICAqXG4gICAqIEBwYXJhbSB7VnVlfSB2bVxuICAgKiBAcGFyYW0ge0VsZW1lbnR8RG9jdW1lbnRGcmFnbWVudH0gZWxcbiAgICogQHBhcmFtIHtWdWV9IFtob3N0XSAtIGhvc3Qgdm0gb2YgdHJhbnNjbHVkZWQgY29udGVudFxuICAgKiBAcGFyYW0ge09iamVjdH0gW3Njb3BlXSAtIHYtZm9yIHNjb3BlXG4gICAqIEBwYXJhbSB7RnJhZ21lbnR9IFtmcmFnXSAtIGxpbmsgY29udGV4dCBmcmFnbWVudFxuICAgKiBAcmV0dXJuIHtGdW5jdGlvbnx1bmRlZmluZWR9XG4gICAqL1xuXG4gIHJldHVybiBmdW5jdGlvbiBjb21wb3NpdGVMaW5rRm4odm0sIGVsLCBob3N0LCBzY29wZSwgZnJhZykge1xuICAgIC8vIGNhY2hlIGNoaWxkTm9kZXMgYmVmb3JlIGxpbmtpbmcgcGFyZW50LCBmaXggIzY1N1xuICAgIHZhciBjaGlsZE5vZGVzID0gdG9BcnJheShlbC5jaGlsZE5vZGVzKTtcbiAgICAvLyBsaW5rXG4gICAgdmFyIGRpcnMgPSBsaW5rQW5kQ2FwdHVyZShmdW5jdGlvbiBjb21wb3NpdGVMaW5rQ2FwdHVyZXIoKSB7XG4gICAgICBpZiAobm9kZUxpbmtGbikgbm9kZUxpbmtGbih2bSwgZWwsIGhvc3QsIHNjb3BlLCBmcmFnKTtcbiAgICAgIGlmIChjaGlsZExpbmtGbikgY2hpbGRMaW5rRm4odm0sIGNoaWxkTm9kZXMsIGhvc3QsIHNjb3BlLCBmcmFnKTtcbiAgICB9LCB2bSk7XG4gICAgcmV0dXJuIG1ha2VVbmxpbmtGbih2bSwgZGlycyk7XG4gIH07XG59XG5cbi8qKlxuICogQXBwbHkgYSBsaW5rZXIgdG8gYSB2bS9lbGVtZW50IHBhaXIgYW5kIGNhcHR1cmUgdGhlXG4gKiBkaXJlY3RpdmVzIGNyZWF0ZWQgZHVyaW5nIHRoZSBwcm9jZXNzLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGxpbmtlclxuICogQHBhcmFtIHtWdWV9IHZtXG4gKi9cblxuZnVuY3Rpb24gbGlua0FuZENhcHR1cmUobGlua2VyLCB2bSkge1xuICB2YXIgb3JpZ2luYWxEaXJDb3VudCA9IHZtLl9kaXJlY3RpdmVzLmxlbmd0aDtcbiAgbGlua2VyKCk7XG4gIHZhciBkaXJzID0gdm0uX2RpcmVjdGl2ZXMuc2xpY2Uob3JpZ2luYWxEaXJDb3VudCk7XG4gIGRpcnMuc29ydChkaXJlY3RpdmVDb21wYXJhdG9yKTtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSBkaXJzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGRpcnNbaV0uX2JpbmQoKTtcbiAgfVxuICByZXR1cm4gZGlycztcbn1cblxuLyoqXG4gKiBEaXJlY3RpdmUgcHJpb3JpdHkgc29ydCBjb21wYXJhdG9yXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGFcbiAqIEBwYXJhbSB7T2JqZWN0fSBiXG4gKi9cblxuZnVuY3Rpb24gZGlyZWN0aXZlQ29tcGFyYXRvcihhLCBiKSB7XG4gIGEgPSBhLmRlc2NyaXB0b3IuZGVmLnByaW9yaXR5IHx8IERFRkFVTFRfUFJJT1JJVFk7XG4gIGIgPSBiLmRlc2NyaXB0b3IuZGVmLnByaW9yaXR5IHx8IERFRkFVTFRfUFJJT1JJVFk7XG4gIHJldHVybiBhID4gYiA/IC0xIDogYSA9PT0gYiA/IDAgOiAxO1xufVxuXG4vKipcbiAqIExpbmtlciBmdW5jdGlvbnMgcmV0dXJuIGFuIHVubGluayBmdW5jdGlvbiB0aGF0XG4gKiB0ZWFyc2Rvd24gYWxsIGRpcmVjdGl2ZXMgaW5zdGFuY2VzIGdlbmVyYXRlZCBkdXJpbmdcbiAqIHRoZSBwcm9jZXNzLlxuICpcbiAqIFdlIGNyZWF0ZSB1bmxpbmsgZnVuY3Rpb25zIHdpdGggb25seSB0aGUgbmVjZXNzYXJ5XG4gKiBpbmZvcm1hdGlvbiB0byBhdm9pZCByZXRhaW5pbmcgYWRkaXRpb25hbCBjbG9zdXJlcy5cbiAqXG4gKiBAcGFyYW0ge1Z1ZX0gdm1cbiAqIEBwYXJhbSB7QXJyYXl9IGRpcnNcbiAqIEBwYXJhbSB7VnVlfSBbY29udGV4dF1cbiAqIEBwYXJhbSB7QXJyYXl9IFtjb250ZXh0RGlyc11cbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICovXG5cbmZ1bmN0aW9uIG1ha2VVbmxpbmtGbih2bSwgZGlycywgY29udGV4dCwgY29udGV4dERpcnMpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHVubGluayhkZXN0cm95aW5nKSB7XG4gICAgdGVhcmRvd25EaXJzKHZtLCBkaXJzLCBkZXN0cm95aW5nKTtcbiAgICBpZiAoY29udGV4dCAmJiBjb250ZXh0RGlycykge1xuICAgICAgdGVhcmRvd25EaXJzKGNvbnRleHQsIGNvbnRleHREaXJzKTtcbiAgICB9XG4gIH07XG59XG5cbi8qKlxuICogVGVhcmRvd24gcGFydGlhbCBsaW5rZWQgZGlyZWN0aXZlcy5cbiAqXG4gKiBAcGFyYW0ge1Z1ZX0gdm1cbiAqIEBwYXJhbSB7QXJyYXl9IGRpcnNcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gZGVzdHJveWluZ1xuICovXG5cbmZ1bmN0aW9uIHRlYXJkb3duRGlycyh2bSwgZGlycywgZGVzdHJveWluZykge1xuICB2YXIgaSA9IGRpcnMubGVuZ3RoO1xuICB3aGlsZSAoaS0tKSB7XG4gICAgZGlyc1tpXS5fdGVhcmRvd24oKTtcbiAgICBpZiAoIWRlc3Ryb3lpbmcpIHtcbiAgICAgIHZtLl9kaXJlY3RpdmVzLiRyZW1vdmUoZGlyc1tpXSk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQ29tcGlsZSBsaW5rIHByb3BzIG9uIGFuIGluc3RhbmNlLlxuICpcbiAqIEBwYXJhbSB7VnVlfSB2bVxuICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICogQHBhcmFtIHtPYmplY3R9IHByb3BzXG4gKiBAcGFyYW0ge09iamVjdH0gW3Njb3BlXVxuICogQHJldHVybiB7RnVuY3Rpb259XG4gKi9cblxuZnVuY3Rpb24gY29tcGlsZUFuZExpbmtQcm9wcyh2bSwgZWwsIHByb3BzLCBzY29wZSkge1xuICB2YXIgcHJvcHNMaW5rRm4gPSBjb21waWxlUHJvcHMoZWwsIHByb3BzKTtcbiAgdmFyIHByb3BEaXJzID0gbGlua0FuZENhcHR1cmUoZnVuY3Rpb24gKCkge1xuICAgIHByb3BzTGlua0ZuKHZtLCBzY29wZSk7XG4gIH0sIHZtKTtcbiAgcmV0dXJuIG1ha2VVbmxpbmtGbih2bSwgcHJvcERpcnMpO1xufVxuXG4vKipcbiAqIENvbXBpbGUgdGhlIHJvb3QgZWxlbWVudCBvZiBhbiBpbnN0YW5jZS5cbiAqXG4gKiAxLiBhdHRycyBvbiBjb250ZXh0IGNvbnRhaW5lciAoY29udGV4dCBzY29wZSlcbiAqIDIuIGF0dHJzIG9uIHRoZSBjb21wb25lbnQgdGVtcGxhdGUgcm9vdCBub2RlLCBpZlxuICogICAgcmVwbGFjZTp0cnVlIChjaGlsZCBzY29wZSlcbiAqXG4gKiBJZiB0aGlzIGlzIGEgZnJhZ21lbnQgaW5zdGFuY2UsIHdlIG9ubHkgbmVlZCB0byBjb21waWxlIDEuXG4gKlxuICogQHBhcmFtIHtWdWV9IHZtXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHRPcHRpb25zXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqL1xuXG5mdW5jdGlvbiBjb21waWxlUm9vdChlbCwgb3B0aW9ucywgY29udGV4dE9wdGlvbnMpIHtcbiAgdmFyIGNvbnRhaW5lckF0dHJzID0gb3B0aW9ucy5fY29udGFpbmVyQXR0cnM7XG4gIHZhciByZXBsYWNlckF0dHJzID0gb3B0aW9ucy5fcmVwbGFjZXJBdHRycztcbiAgdmFyIGNvbnRleHRMaW5rRm4sIHJlcGxhY2VyTGlua0ZuO1xuXG4gIC8vIG9ubHkgbmVlZCB0byBjb21waWxlIG90aGVyIGF0dHJpYnV0ZXMgZm9yXG4gIC8vIG5vbi1mcmFnbWVudCBpbnN0YW5jZXNcbiAgaWYgKGVsLm5vZGVUeXBlICE9PSAxMSkge1xuICAgIC8vIGZvciBjb21wb25lbnRzLCBjb250YWluZXIgYW5kIHJlcGxhY2VyIG5lZWQgdG8gYmVcbiAgICAvLyBjb21waWxlZCBzZXBhcmF0ZWx5IGFuZCBsaW5rZWQgaW4gZGlmZmVyZW50IHNjb3Blcy5cbiAgICBpZiAob3B0aW9ucy5fYXNDb21wb25lbnQpIHtcbiAgICAgIC8vIDIuIGNvbnRhaW5lciBhdHRyaWJ1dGVzXG4gICAgICBpZiAoY29udGFpbmVyQXR0cnMgJiYgY29udGV4dE9wdGlvbnMpIHtcbiAgICAgICAgY29udGV4dExpbmtGbiA9IGNvbXBpbGVEaXJlY3RpdmVzKGNvbnRhaW5lckF0dHJzLCBjb250ZXh0T3B0aW9ucyk7XG4gICAgICB9XG4gICAgICBpZiAocmVwbGFjZXJBdHRycykge1xuICAgICAgICAvLyAzLiByZXBsYWNlciBhdHRyaWJ1dGVzXG4gICAgICAgIHJlcGxhY2VyTGlua0ZuID0gY29tcGlsZURpcmVjdGl2ZXMocmVwbGFjZXJBdHRycywgb3B0aW9ucyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIG5vbi1jb21wb25lbnQsIGp1c3QgY29tcGlsZSBhcyBhIG5vcm1hbCBlbGVtZW50LlxuICAgICAgcmVwbGFjZXJMaW5rRm4gPSBjb21waWxlRGlyZWN0aXZlcyhlbC5hdHRyaWJ1dGVzLCBvcHRpb25zKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBjb250YWluZXJBdHRycykge1xuICAgIC8vIHdhcm4gY29udGFpbmVyIGRpcmVjdGl2ZXMgZm9yIGZyYWdtZW50IGluc3RhbmNlc1xuICAgIHZhciBuYW1lcyA9IGNvbnRhaW5lckF0dHJzLmZpbHRlcihmdW5jdGlvbiAoYXR0cikge1xuICAgICAgLy8gYWxsb3cgdnVlLWxvYWRlci92dWVpZnkgc2NvcGVkIGNzcyBhdHRyaWJ1dGVzXG4gICAgICByZXR1cm4gYXR0ci5uYW1lLmluZGV4T2YoJ192LScpIDwgMCAmJlxuICAgICAgLy8gYWxsb3cgZXZlbnQgbGlzdGVuZXJzXG4gICAgICAhb25SRS50ZXN0KGF0dHIubmFtZSkgJiZcbiAgICAgIC8vIGFsbG93IHNsb3RzXG4gICAgICBhdHRyLm5hbWUgIT09ICdzbG90JztcbiAgICB9KS5tYXAoZnVuY3Rpb24gKGF0dHIpIHtcbiAgICAgIHJldHVybiAnXCInICsgYXR0ci5uYW1lICsgJ1wiJztcbiAgICB9KTtcbiAgICBpZiAobmFtZXMubGVuZ3RoKSB7XG4gICAgICB2YXIgcGx1cmFsID0gbmFtZXMubGVuZ3RoID4gMTtcbiAgICAgIHdhcm4oJ0F0dHJpYnV0ZScgKyAocGx1cmFsID8gJ3MgJyA6ICcgJykgKyBuYW1lcy5qb2luKCcsICcpICsgKHBsdXJhbCA/ICcgYXJlJyA6ICcgaXMnKSArICcgaWdub3JlZCBvbiBjb21wb25lbnQgJyArICc8JyArIG9wdGlvbnMuZWwudGFnTmFtZS50b0xvd2VyQ2FzZSgpICsgJz4gYmVjYXVzZSAnICsgJ3RoZSBjb21wb25lbnQgaXMgYSBmcmFnbWVudCBpbnN0YW5jZTogJyArICdodHRwOi8vdnVlanMub3JnL2d1aWRlL2NvbXBvbmVudHMuaHRtbCNGcmFnbWVudF9JbnN0YW5jZScpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbiByb290TGlua0ZuKHZtLCBlbCwgc2NvcGUpIHtcbiAgICAvLyBsaW5rIGNvbnRleHQgc2NvcGUgZGlyc1xuICAgIHZhciBjb250ZXh0ID0gdm0uX2NvbnRleHQ7XG4gICAgdmFyIGNvbnRleHREaXJzO1xuICAgIGlmIChjb250ZXh0ICYmIGNvbnRleHRMaW5rRm4pIHtcbiAgICAgIGNvbnRleHREaXJzID0gbGlua0FuZENhcHR1cmUoZnVuY3Rpb24gKCkge1xuICAgICAgICBjb250ZXh0TGlua0ZuKGNvbnRleHQsIGVsLCBudWxsLCBzY29wZSk7XG4gICAgICB9LCBjb250ZXh0KTtcbiAgICB9XG5cbiAgICAvLyBsaW5rIHNlbGZcbiAgICB2YXIgc2VsZkRpcnMgPSBsaW5rQW5kQ2FwdHVyZShmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAocmVwbGFjZXJMaW5rRm4pIHJlcGxhY2VyTGlua0ZuKHZtLCBlbCk7XG4gICAgfSwgdm0pO1xuXG4gICAgLy8gcmV0dXJuIHRoZSB1bmxpbmsgZnVuY3Rpb24gdGhhdCB0ZWFyc2Rvd24gY29udGV4dFxuICAgIC8vIGNvbnRhaW5lciBkaXJlY3RpdmVzLlxuICAgIHJldHVybiBtYWtlVW5saW5rRm4odm0sIHNlbGZEaXJzLCBjb250ZXh0LCBjb250ZXh0RGlycyk7XG4gIH07XG59XG5cbi8qKlxuICogQ29tcGlsZSBhIG5vZGUgYW5kIHJldHVybiBhIG5vZGVMaW5rRm4gYmFzZWQgb24gdGhlXG4gKiBub2RlIHR5cGUuXG4gKlxuICogQHBhcmFtIHtOb2RlfSBub2RlXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHJldHVybiB7RnVuY3Rpb258bnVsbH1cbiAqL1xuXG5mdW5jdGlvbiBjb21waWxlTm9kZShub2RlLCBvcHRpb25zKSB7XG4gIHZhciB0eXBlID0gbm9kZS5ub2RlVHlwZTtcbiAgaWYgKHR5cGUgPT09IDEgJiYgbm9kZS50YWdOYW1lICE9PSAnU0NSSVBUJykge1xuICAgIHJldHVybiBjb21waWxlRWxlbWVudChub2RlLCBvcHRpb25zKTtcbiAgfSBlbHNlIGlmICh0eXBlID09PSAzICYmIG5vZGUuZGF0YS50cmltKCkpIHtcbiAgICByZXR1cm4gY29tcGlsZVRleHROb2RlKG5vZGUsIG9wdGlvbnMpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbi8qKlxuICogQ29tcGlsZSBhbiBlbGVtZW50IGFuZCByZXR1cm4gYSBub2RlTGlua0ZuLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtGdW5jdGlvbnxudWxsfVxuICovXG5cbmZ1bmN0aW9uIGNvbXBpbGVFbGVtZW50KGVsLCBvcHRpb25zKSB7XG4gIC8vIHByZXByb2Nlc3MgdGV4dGFyZWFzLlxuICAvLyB0ZXh0YXJlYSB0cmVhdHMgaXRzIHRleHQgY29udGVudCBhcyB0aGUgaW5pdGlhbCB2YWx1ZS5cbiAgLy8ganVzdCBiaW5kIGl0IGFzIGFuIGF0dHIgZGlyZWN0aXZlIGZvciB2YWx1ZS5cbiAgaWYgKGVsLnRhZ05hbWUgPT09ICdURVhUQVJFQScpIHtcbiAgICB2YXIgdG9rZW5zID0gcGFyc2VUZXh0KGVsLnZhbHVlKTtcbiAgICBpZiAodG9rZW5zKSB7XG4gICAgICBlbC5zZXRBdHRyaWJ1dGUoJzp2YWx1ZScsIHRva2Vuc1RvRXhwKHRva2VucykpO1xuICAgICAgZWwudmFsdWUgPSAnJztcbiAgICB9XG4gIH1cbiAgdmFyIGxpbmtGbjtcbiAgdmFyIGhhc0F0dHJzID0gZWwuaGFzQXR0cmlidXRlcygpO1xuICAvLyBjaGVjayB0ZXJtaW5hbCBkaXJlY3RpdmVzIChmb3IgJiBpZilcbiAgaWYgKGhhc0F0dHJzKSB7XG4gICAgbGlua0ZuID0gY2hlY2tUZXJtaW5hbERpcmVjdGl2ZXMoZWwsIG9wdGlvbnMpO1xuICB9XG4gIC8vIGNoZWNrIGVsZW1lbnQgZGlyZWN0aXZlc1xuICBpZiAoIWxpbmtGbikge1xuICAgIGxpbmtGbiA9IGNoZWNrRWxlbWVudERpcmVjdGl2ZXMoZWwsIG9wdGlvbnMpO1xuICB9XG4gIC8vIGNoZWNrIGNvbXBvbmVudFxuICBpZiAoIWxpbmtGbikge1xuICAgIGxpbmtGbiA9IGNoZWNrQ29tcG9uZW50KGVsLCBvcHRpb25zKTtcbiAgfVxuICAvLyBub3JtYWwgZGlyZWN0aXZlc1xuICBpZiAoIWxpbmtGbiAmJiBoYXNBdHRycykge1xuICAgIGxpbmtGbiA9IGNvbXBpbGVEaXJlY3RpdmVzKGVsLmF0dHJpYnV0ZXMsIG9wdGlvbnMpO1xuICB9XG4gIHJldHVybiBsaW5rRm47XG59XG5cbi8qKlxuICogQ29tcGlsZSBhIHRleHROb2RlIGFuZCByZXR1cm4gYSBub2RlTGlua0ZuLlxuICpcbiAqIEBwYXJhbSB7VGV4dE5vZGV9IG5vZGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtGdW5jdGlvbnxudWxsfSB0ZXh0Tm9kZUxpbmtGblxuICovXG5cbmZ1bmN0aW9uIGNvbXBpbGVUZXh0Tm9kZShub2RlLCBvcHRpb25zKSB7XG4gIC8vIHNraXAgbWFya2VkIHRleHQgbm9kZXNcbiAgaWYgKG5vZGUuX3NraXApIHtcbiAgICByZXR1cm4gcmVtb3ZlVGV4dDtcbiAgfVxuXG4gIHZhciB0b2tlbnMgPSBwYXJzZVRleHQobm9kZS53aG9sZVRleHQpO1xuICBpZiAoIXRva2Vucykge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLy8gbWFyayBhZGphY2VudCB0ZXh0IG5vZGVzIGFzIHNraXBwZWQsXG4gIC8vIGJlY2F1c2Ugd2UgYXJlIHVzaW5nIG5vZGUud2hvbGVUZXh0IHRvIGNvbXBpbGVcbiAgLy8gYWxsIGFkamFjZW50IHRleHQgbm9kZXMgdG9nZXRoZXIuIFRoaXMgZml4ZXNcbiAgLy8gaXNzdWVzIGluIElFIHdoZXJlIHNvbWV0aW1lcyBpdCBzcGxpdHMgdXAgYSBzaW5nbGVcbiAgLy8gdGV4dCBub2RlIGludG8gbXVsdGlwbGUgb25lcy5cbiAgdmFyIG5leHQgPSBub2RlLm5leHRTaWJsaW5nO1xuICB3aGlsZSAobmV4dCAmJiBuZXh0Lm5vZGVUeXBlID09PSAzKSB7XG4gICAgbmV4dC5fc2tpcCA9IHRydWU7XG4gICAgbmV4dCA9IG5leHQubmV4dFNpYmxpbmc7XG4gIH1cblxuICB2YXIgZnJhZyA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgdmFyIGVsLCB0b2tlbjtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSB0b2tlbnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgdG9rZW4gPSB0b2tlbnNbaV07XG4gICAgZWwgPSB0b2tlbi50YWcgPyBwcm9jZXNzVGV4dFRva2VuKHRva2VuLCBvcHRpb25zKSA6IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHRva2VuLnZhbHVlKTtcbiAgICBmcmFnLmFwcGVuZENoaWxkKGVsKTtcbiAgfVxuICByZXR1cm4gbWFrZVRleHROb2RlTGlua0ZuKHRva2VucywgZnJhZywgb3B0aW9ucyk7XG59XG5cbi8qKlxuICogTGlua2VyIGZvciBhbiBza2lwcGVkIHRleHQgbm9kZS5cbiAqXG4gKiBAcGFyYW0ge1Z1ZX0gdm1cbiAqIEBwYXJhbSB7VGV4dH0gbm9kZVxuICovXG5cbmZ1bmN0aW9uIHJlbW92ZVRleHQodm0sIG5vZGUpIHtcbiAgcmVtb3ZlKG5vZGUpO1xufVxuXG4vKipcbiAqIFByb2Nlc3MgYSBzaW5nbGUgdGV4dCB0b2tlbi5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdG9rZW5cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtOb2RlfVxuICovXG5cbmZ1bmN0aW9uIHByb2Nlc3NUZXh0VG9rZW4odG9rZW4sIG9wdGlvbnMpIHtcbiAgdmFyIGVsO1xuICBpZiAodG9rZW4ub25lVGltZSkge1xuICAgIGVsID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodG9rZW4udmFsdWUpO1xuICB9IGVsc2Uge1xuICAgIGlmICh0b2tlbi5odG1sKSB7XG4gICAgICBlbCA9IGRvY3VtZW50LmNyZWF0ZUNvbW1lbnQoJ3YtaHRtbCcpO1xuICAgICAgc2V0VG9rZW5UeXBlKCdodG1sJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIElFIHdpbGwgY2xlYW4gdXAgZW1wdHkgdGV4dE5vZGVzIGR1cmluZ1xuICAgICAgLy8gZnJhZy5jbG9uZU5vZGUodHJ1ZSksIHNvIHdlIGhhdmUgdG8gZ2l2ZSBpdFxuICAgICAgLy8gc29tZXRoaW5nIGhlcmUuLi5cbiAgICAgIGVsID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJyAnKTtcbiAgICAgIHNldFRva2VuVHlwZSgndGV4dCcpO1xuICAgIH1cbiAgfVxuICBmdW5jdGlvbiBzZXRUb2tlblR5cGUodHlwZSkge1xuICAgIGlmICh0b2tlbi5kZXNjcmlwdG9yKSByZXR1cm47XG4gICAgdmFyIHBhcnNlZCA9IHBhcnNlRGlyZWN0aXZlKHRva2VuLnZhbHVlKTtcbiAgICB0b2tlbi5kZXNjcmlwdG9yID0ge1xuICAgICAgbmFtZTogdHlwZSxcbiAgICAgIGRlZjogcHVibGljRGlyZWN0aXZlc1t0eXBlXSxcbiAgICAgIGV4cHJlc3Npb246IHBhcnNlZC5leHByZXNzaW9uLFxuICAgICAgZmlsdGVyczogcGFyc2VkLmZpbHRlcnNcbiAgICB9O1xuICB9XG4gIHJldHVybiBlbDtcbn1cblxuLyoqXG4gKiBCdWlsZCBhIGZ1bmN0aW9uIHRoYXQgcHJvY2Vzc2VzIGEgdGV4dE5vZGUuXG4gKlxuICogQHBhcmFtIHtBcnJheTxPYmplY3Q+fSB0b2tlbnNcbiAqIEBwYXJhbSB7RG9jdW1lbnRGcmFnbWVudH0gZnJhZ1xuICovXG5cbmZ1bmN0aW9uIG1ha2VUZXh0Tm9kZUxpbmtGbih0b2tlbnMsIGZyYWcpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHRleHROb2RlTGlua0ZuKHZtLCBlbCwgaG9zdCwgc2NvcGUpIHtcbiAgICB2YXIgZnJhZ0Nsb25lID0gZnJhZy5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgdmFyIGNoaWxkTm9kZXMgPSB0b0FycmF5KGZyYWdDbG9uZS5jaGlsZE5vZGVzKTtcbiAgICB2YXIgdG9rZW4sIHZhbHVlLCBub2RlO1xuICAgIGZvciAodmFyIGkgPSAwLCBsID0gdG9rZW5zLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgdG9rZW4gPSB0b2tlbnNbaV07XG4gICAgICB2YWx1ZSA9IHRva2VuLnZhbHVlO1xuICAgICAgaWYgKHRva2VuLnRhZykge1xuICAgICAgICBub2RlID0gY2hpbGROb2Rlc1tpXTtcbiAgICAgICAgaWYgKHRva2VuLm9uZVRpbWUpIHtcbiAgICAgICAgICB2YWx1ZSA9IChzY29wZSB8fCB2bSkuJGV2YWwodmFsdWUpO1xuICAgICAgICAgIGlmICh0b2tlbi5odG1sKSB7XG4gICAgICAgICAgICByZXBsYWNlKG5vZGUsIHBhcnNlVGVtcGxhdGUodmFsdWUsIHRydWUpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbm9kZS5kYXRhID0gdmFsdWU7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZtLl9iaW5kRGlyKHRva2VuLmRlc2NyaXB0b3IsIG5vZGUsIGhvc3QsIHNjb3BlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXBsYWNlKGVsLCBmcmFnQ2xvbmUpO1xuICB9O1xufVxuXG4vKipcbiAqIENvbXBpbGUgYSBub2RlIGxpc3QgYW5kIHJldHVybiBhIGNoaWxkTGlua0ZuLlxuICpcbiAqIEBwYXJhbSB7Tm9kZUxpc3R9IG5vZGVMaXN0XG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHJldHVybiB7RnVuY3Rpb258dW5kZWZpbmVkfVxuICovXG5cbmZ1bmN0aW9uIGNvbXBpbGVOb2RlTGlzdChub2RlTGlzdCwgb3B0aW9ucykge1xuICB2YXIgbGlua0ZucyA9IFtdO1xuICB2YXIgbm9kZUxpbmtGbiwgY2hpbGRMaW5rRm4sIG5vZGU7XG4gIGZvciAodmFyIGkgPSAwLCBsID0gbm9kZUxpc3QubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgbm9kZSA9IG5vZGVMaXN0W2ldO1xuICAgIG5vZGVMaW5rRm4gPSBjb21waWxlTm9kZShub2RlLCBvcHRpb25zKTtcbiAgICBjaGlsZExpbmtGbiA9ICEobm9kZUxpbmtGbiAmJiBub2RlTGlua0ZuLnRlcm1pbmFsKSAmJiBub2RlLnRhZ05hbWUgIT09ICdTQ1JJUFQnICYmIG5vZGUuaGFzQ2hpbGROb2RlcygpID8gY29tcGlsZU5vZGVMaXN0KG5vZGUuY2hpbGROb2Rlcywgb3B0aW9ucykgOiBudWxsO1xuICAgIGxpbmtGbnMucHVzaChub2RlTGlua0ZuLCBjaGlsZExpbmtGbik7XG4gIH1cbiAgcmV0dXJuIGxpbmtGbnMubGVuZ3RoID8gbWFrZUNoaWxkTGlua0ZuKGxpbmtGbnMpIDogbnVsbDtcbn1cblxuLyoqXG4gKiBNYWtlIGEgY2hpbGQgbGluayBmdW5jdGlvbiBmb3IgYSBub2RlJ3MgY2hpbGROb2Rlcy5cbiAqXG4gKiBAcGFyYW0ge0FycmF5PEZ1bmN0aW9uPn0gbGlua0Zuc1xuICogQHJldHVybiB7RnVuY3Rpb259IGNoaWxkTGlua0ZuXG4gKi9cblxuZnVuY3Rpb24gbWFrZUNoaWxkTGlua0ZuKGxpbmtGbnMpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIGNoaWxkTGlua0ZuKHZtLCBub2RlcywgaG9zdCwgc2NvcGUsIGZyYWcpIHtcbiAgICB2YXIgbm9kZSwgbm9kZUxpbmtGbiwgY2hpbGRyZW5MaW5rRm47XG4gICAgZm9yICh2YXIgaSA9IDAsIG4gPSAwLCBsID0gbGlua0Zucy5sZW5ndGg7IGkgPCBsOyBuKyspIHtcbiAgICAgIG5vZGUgPSBub2Rlc1tuXTtcbiAgICAgIG5vZGVMaW5rRm4gPSBsaW5rRm5zW2krK107XG4gICAgICBjaGlsZHJlbkxpbmtGbiA9IGxpbmtGbnNbaSsrXTtcbiAgICAgIC8vIGNhY2hlIGNoaWxkTm9kZXMgYmVmb3JlIGxpbmtpbmcgcGFyZW50LCBmaXggIzY1N1xuICAgICAgdmFyIGNoaWxkTm9kZXMgPSB0b0FycmF5KG5vZGUuY2hpbGROb2Rlcyk7XG4gICAgICBpZiAobm9kZUxpbmtGbikge1xuICAgICAgICBub2RlTGlua0ZuKHZtLCBub2RlLCBob3N0LCBzY29wZSwgZnJhZyk7XG4gICAgICB9XG4gICAgICBpZiAoY2hpbGRyZW5MaW5rRm4pIHtcbiAgICAgICAgY2hpbGRyZW5MaW5rRm4odm0sIGNoaWxkTm9kZXMsIGhvc3QsIHNjb3BlLCBmcmFnKTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG59XG5cbi8qKlxuICogQ2hlY2sgZm9yIGVsZW1lbnQgZGlyZWN0aXZlcyAoY3VzdG9tIGVsZW1lbnRzIHRoYXQgc2hvdWxkXG4gKiBiZSByZXNvdmxlZCBhcyB0ZXJtaW5hbCBkaXJlY3RpdmVzKS5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICovXG5cbmZ1bmN0aW9uIGNoZWNrRWxlbWVudERpcmVjdGl2ZXMoZWwsIG9wdGlvbnMpIHtcbiAgdmFyIHRhZyA9IGVsLnRhZ05hbWUudG9Mb3dlckNhc2UoKTtcbiAgaWYgKGNvbW1vblRhZ1JFLnRlc3QodGFnKSkgcmV0dXJuO1xuICAvLyBzcGVjaWFsIGNhc2U6IGdpdmUgbmFtZWQgc2xvdCBhIGhpZ2hlciBwcmlvcml0eVxuICAvLyB0aGFuIHVubmFtZWQgc2xvdHNcbiAgaWYgKHRhZyA9PT0gJ3Nsb3QnICYmIGhhc0JpbmRBdHRyKGVsLCAnbmFtZScpKSB7XG4gICAgdGFnID0gJ19uYW1lZFNsb3QnO1xuICB9XG4gIHZhciBkZWYgPSByZXNvbHZlQXNzZXQob3B0aW9ucywgJ2VsZW1lbnREaXJlY3RpdmVzJywgdGFnKTtcbiAgaWYgKGRlZikge1xuICAgIHJldHVybiBtYWtlVGVybWluYWxOb2RlTGlua0ZuKGVsLCB0YWcsICcnLCBvcHRpb25zLCBkZWYpO1xuICB9XG59XG5cbi8qKlxuICogQ2hlY2sgaWYgYW4gZWxlbWVudCBpcyBhIGNvbXBvbmVudC4gSWYgeWVzLCByZXR1cm5cbiAqIGEgY29tcG9uZW50IGxpbmsgZnVuY3Rpb24uXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufHVuZGVmaW5lZH1cbiAqL1xuXG5mdW5jdGlvbiBjaGVja0NvbXBvbmVudChlbCwgb3B0aW9ucykge1xuICB2YXIgY29tcG9uZW50ID0gY2hlY2tDb21wb25lbnRBdHRyKGVsLCBvcHRpb25zKTtcbiAgaWYgKGNvbXBvbmVudCkge1xuICAgIHZhciByZWYgPSBmaW5kUmVmKGVsKTtcbiAgICB2YXIgZGVzY3JpcHRvciA9IHtcbiAgICAgIG5hbWU6ICdjb21wb25lbnQnLFxuICAgICAgcmVmOiByZWYsXG4gICAgICBleHByZXNzaW9uOiBjb21wb25lbnQuaWQsXG4gICAgICBkZWY6IGludGVybmFsRGlyZWN0aXZlcy5jb21wb25lbnQsXG4gICAgICBtb2RpZmllcnM6IHtcbiAgICAgICAgbGl0ZXJhbDogIWNvbXBvbmVudC5keW5hbWljXG4gICAgICB9XG4gICAgfTtcbiAgICB2YXIgY29tcG9uZW50TGlua0ZuID0gZnVuY3Rpb24gY29tcG9uZW50TGlua0ZuKHZtLCBlbCwgaG9zdCwgc2NvcGUsIGZyYWcpIHtcbiAgICAgIGlmIChyZWYpIHtcbiAgICAgICAgZGVmaW5lUmVhY3RpdmUoKHNjb3BlIHx8IHZtKS4kcmVmcywgcmVmLCBudWxsKTtcbiAgICAgIH1cbiAgICAgIHZtLl9iaW5kRGlyKGRlc2NyaXB0b3IsIGVsLCBob3N0LCBzY29wZSwgZnJhZyk7XG4gICAgfTtcbiAgICBjb21wb25lbnRMaW5rRm4udGVybWluYWwgPSB0cnVlO1xuICAgIHJldHVybiBjb21wb25lbnRMaW5rRm47XG4gIH1cbn1cblxuLyoqXG4gKiBDaGVjayBhbiBlbGVtZW50IGZvciB0ZXJtaW5hbCBkaXJlY3RpdmVzIGluIGZpeGVkIG9yZGVyLlxuICogSWYgaXQgZmluZHMgb25lLCByZXR1cm4gYSB0ZXJtaW5hbCBsaW5rIGZ1bmN0aW9uLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn0gdGVybWluYWxMaW5rRm5cbiAqL1xuXG5mdW5jdGlvbiBjaGVja1Rlcm1pbmFsRGlyZWN0aXZlcyhlbCwgb3B0aW9ucykge1xuICAvLyBza2lwIHYtcHJlXG4gIGlmIChnZXRBdHRyKGVsLCAndi1wcmUnKSAhPT0gbnVsbCkge1xuICAgIHJldHVybiBza2lwO1xuICB9XG4gIC8vIHNraXAgdi1lbHNlIGJsb2NrLCBidXQgb25seSBpZiBmb2xsb3dpbmcgdi1pZlxuICBpZiAoZWwuaGFzQXR0cmlidXRlKCd2LWVsc2UnKSkge1xuICAgIHZhciBwcmV2ID0gZWwucHJldmlvdXNFbGVtZW50U2libGluZztcbiAgICBpZiAocHJldiAmJiBwcmV2Lmhhc0F0dHJpYnV0ZSgndi1pZicpKSB7XG4gICAgICByZXR1cm4gc2tpcDtcbiAgICB9XG4gIH1cbiAgdmFyIHZhbHVlLCBkaXJOYW1lO1xuICBmb3IgKHZhciBpID0gMCwgbCA9IHRlcm1pbmFsRGlyZWN0aXZlcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBkaXJOYW1lID0gdGVybWluYWxEaXJlY3RpdmVzW2ldO1xuICAgIC8qIGVzbGludC1kaXNhYmxlIG5vLWNvbmQtYXNzaWduICovXG4gICAgaWYgKHZhbHVlID0gZWwuZ2V0QXR0cmlidXRlKCd2LScgKyBkaXJOYW1lKSkge1xuICAgICAgcmV0dXJuIG1ha2VUZXJtaW5hbE5vZGVMaW5rRm4oZWwsIGRpck5hbWUsIHZhbHVlLCBvcHRpb25zKTtcbiAgICB9XG4gICAgLyogZXNsaW50LWVuYWJsZSBuby1jb25kLWFzc2lnbiAqL1xuICB9XG59XG5cbmZ1bmN0aW9uIHNraXAoKSB7fVxuc2tpcC50ZXJtaW5hbCA9IHRydWU7XG5cbi8qKlxuICogQnVpbGQgYSBub2RlIGxpbmsgZnVuY3Rpb24gZm9yIGEgdGVybWluYWwgZGlyZWN0aXZlLlxuICogQSB0ZXJtaW5hbCBsaW5rIGZ1bmN0aW9uIHRlcm1pbmF0ZXMgdGhlIGN1cnJlbnRcbiAqIGNvbXBpbGF0aW9uIHJlY3Vyc2lvbiBhbmQgaGFuZGxlcyBjb21waWxhdGlvbiBvZiB0aGVcbiAqIHN1YnRyZWUgaW4gdGhlIGRpcmVjdGl2ZS5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKiBAcGFyYW0ge1N0cmluZ30gZGlyTmFtZVxuICogQHBhcmFtIHtTdHJpbmd9IHZhbHVlXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHBhcmFtIHtPYmplY3R9IFtkZWZdXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn0gdGVybWluYWxMaW5rRm5cbiAqL1xuXG5mdW5jdGlvbiBtYWtlVGVybWluYWxOb2RlTGlua0ZuKGVsLCBkaXJOYW1lLCB2YWx1ZSwgb3B0aW9ucywgZGVmKSB7XG4gIHZhciBwYXJzZWQgPSBwYXJzZURpcmVjdGl2ZSh2YWx1ZSk7XG4gIHZhciBkZXNjcmlwdG9yID0ge1xuICAgIG5hbWU6IGRpck5hbWUsXG4gICAgZXhwcmVzc2lvbjogcGFyc2VkLmV4cHJlc3Npb24sXG4gICAgZmlsdGVyczogcGFyc2VkLmZpbHRlcnMsXG4gICAgcmF3OiB2YWx1ZSxcbiAgICAvLyBlaXRoZXIgYW4gZWxlbWVudCBkaXJlY3RpdmUsIG9yIGlmL2ZvclxuICAgIGRlZjogZGVmIHx8IHB1YmxpY0RpcmVjdGl2ZXNbZGlyTmFtZV1cbiAgfTtcbiAgLy8gY2hlY2sgcmVmIGZvciB2LWZvciBhbmQgcm91dGVyLXZpZXdcbiAgaWYgKGRpck5hbWUgPT09ICdmb3InIHx8IGRpck5hbWUgPT09ICdyb3V0ZXItdmlldycpIHtcbiAgICBkZXNjcmlwdG9yLnJlZiA9IGZpbmRSZWYoZWwpO1xuICB9XG4gIHZhciBmbiA9IGZ1bmN0aW9uIHRlcm1pbmFsTm9kZUxpbmtGbih2bSwgZWwsIGhvc3QsIHNjb3BlLCBmcmFnKSB7XG4gICAgaWYgKGRlc2NyaXB0b3IucmVmKSB7XG4gICAgICBkZWZpbmVSZWFjdGl2ZSgoc2NvcGUgfHwgdm0pLiRyZWZzLCBkZXNjcmlwdG9yLnJlZiwgbnVsbCk7XG4gICAgfVxuICAgIHZtLl9iaW5kRGlyKGRlc2NyaXB0b3IsIGVsLCBob3N0LCBzY29wZSwgZnJhZyk7XG4gIH07XG4gIGZuLnRlcm1pbmFsID0gdHJ1ZTtcbiAgcmV0dXJuIGZuO1xufVxuXG4vKipcbiAqIENvbXBpbGUgdGhlIGRpcmVjdGl2ZXMgb24gYW4gZWxlbWVudCBhbmQgcmV0dXJuIGEgbGlua2VyLlxuICpcbiAqIEBwYXJhbSB7QXJyYXl8TmFtZWROb2RlTWFwfSBhdHRyc1xuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICovXG5cbmZ1bmN0aW9uIGNvbXBpbGVEaXJlY3RpdmVzKGF0dHJzLCBvcHRpb25zKSB7XG4gIHZhciBpID0gYXR0cnMubGVuZ3RoO1xuICB2YXIgZGlycyA9IFtdO1xuICB2YXIgYXR0ciwgbmFtZSwgdmFsdWUsIHJhd05hbWUsIHJhd1ZhbHVlLCBkaXJOYW1lLCBhcmcsIG1vZGlmaWVycywgZGlyRGVmLCB0b2tlbnM7XG4gIHdoaWxlIChpLS0pIHtcbiAgICBhdHRyID0gYXR0cnNbaV07XG4gICAgbmFtZSA9IHJhd05hbWUgPSBhdHRyLm5hbWU7XG4gICAgdmFsdWUgPSByYXdWYWx1ZSA9IGF0dHIudmFsdWU7XG4gICAgdG9rZW5zID0gcGFyc2VUZXh0KHZhbHVlKTtcbiAgICAvLyByZXNldCBhcmdcbiAgICBhcmcgPSBudWxsO1xuICAgIC8vIGNoZWNrIG1vZGlmaWVyc1xuICAgIG1vZGlmaWVycyA9IHBhcnNlTW9kaWZpZXJzKG5hbWUpO1xuICAgIG5hbWUgPSBuYW1lLnJlcGxhY2UobW9kaWZpZXJSRSwgJycpO1xuXG4gICAgLy8gYXR0cmlidXRlIGludGVycG9sYXRpb25zXG4gICAgaWYgKHRva2Vucykge1xuICAgICAgdmFsdWUgPSB0b2tlbnNUb0V4cCh0b2tlbnMpO1xuICAgICAgYXJnID0gbmFtZTtcbiAgICAgIHB1c2hEaXIoJ2JpbmQnLCBwdWJsaWNEaXJlY3RpdmVzLmJpbmQsIHRydWUpO1xuICAgICAgLy8gd2FybiBhZ2FpbnN0IG1peGluZyBtdXN0YWNoZXMgd2l0aCB2LWJpbmRcbiAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgIGlmIChuYW1lID09PSAnY2xhc3MnICYmIEFycmF5LnByb3RvdHlwZS5zb21lLmNhbGwoYXR0cnMsIGZ1bmN0aW9uIChhdHRyKSB7XG4gICAgICAgICAgcmV0dXJuIGF0dHIubmFtZSA9PT0gJzpjbGFzcycgfHwgYXR0ci5uYW1lID09PSAndi1iaW5kOmNsYXNzJztcbiAgICAgICAgfSkpIHtcbiAgICAgICAgICB3YXJuKCdjbGFzcz1cIicgKyByYXdWYWx1ZSArICdcIjogRG8gbm90IG1peCBtdXN0YWNoZSBpbnRlcnBvbGF0aW9uICcgKyAnYW5kIHYtYmluZCBmb3IgXCJjbGFzc1wiIG9uIHRoZSBzYW1lIGVsZW1lbnQuIFVzZSBvbmUgb3IgdGhlIG90aGVyLicpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlXG5cbiAgICAgIC8vIHNwZWNpYWwgYXR0cmlidXRlOiB0cmFuc2l0aW9uXG4gICAgICBpZiAodHJhbnNpdGlvblJFLnRlc3QobmFtZSkpIHtcbiAgICAgICAgbW9kaWZpZXJzLmxpdGVyYWwgPSAhYmluZFJFLnRlc3QobmFtZSk7XG4gICAgICAgIHB1c2hEaXIoJ3RyYW5zaXRpb24nLCBpbnRlcm5hbERpcmVjdGl2ZXMudHJhbnNpdGlvbik7XG4gICAgICB9IGVsc2VcblxuICAgICAgICAvLyBldmVudCBoYW5kbGVyc1xuICAgICAgICBpZiAob25SRS50ZXN0KG5hbWUpKSB7XG4gICAgICAgICAgYXJnID0gbmFtZS5yZXBsYWNlKG9uUkUsICcnKTtcbiAgICAgICAgICBwdXNoRGlyKCdvbicsIHB1YmxpY0RpcmVjdGl2ZXMub24pO1xuICAgICAgICB9IGVsc2VcblxuICAgICAgICAgIC8vIGF0dHJpYnV0ZSBiaW5kaW5nc1xuICAgICAgICAgIGlmIChiaW5kUkUudGVzdChuYW1lKSkge1xuICAgICAgICAgICAgZGlyTmFtZSA9IG5hbWUucmVwbGFjZShiaW5kUkUsICcnKTtcbiAgICAgICAgICAgIGlmIChkaXJOYW1lID09PSAnc3R5bGUnIHx8IGRpck5hbWUgPT09ICdjbGFzcycpIHtcbiAgICAgICAgICAgICAgcHVzaERpcihkaXJOYW1lLCBpbnRlcm5hbERpcmVjdGl2ZXNbZGlyTmFtZV0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgYXJnID0gZGlyTmFtZTtcbiAgICAgICAgICAgICAgcHVzaERpcignYmluZCcsIHB1YmxpY0RpcmVjdGl2ZXMuYmluZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlXG5cbiAgICAgICAgICAgIC8vIG5vcm1hbCBkaXJlY3RpdmVzXG4gICAgICAgICAgICBpZiAobmFtZS5pbmRleE9mKCd2LScpID09PSAwKSB7XG4gICAgICAgICAgICAgIC8vIGNoZWNrIGFyZ1xuICAgICAgICAgICAgICBhcmcgPSAoYXJnID0gbmFtZS5tYXRjaChhcmdSRSkpICYmIGFyZ1sxXTtcbiAgICAgICAgICAgICAgaWYgKGFyZykge1xuICAgICAgICAgICAgICAgIG5hbWUgPSBuYW1lLnJlcGxhY2UoYXJnUkUsICcnKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvLyBleHRyYWN0IGRpcmVjdGl2ZSBuYW1lXG4gICAgICAgICAgICAgIGRpck5hbWUgPSBuYW1lLnNsaWNlKDIpO1xuXG4gICAgICAgICAgICAgIC8vIHNraXAgdi1lbHNlICh3aGVuIHVzZWQgd2l0aCB2LXNob3cpXG4gICAgICAgICAgICAgIGlmIChkaXJOYW1lID09PSAnZWxzZScpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGRpckRlZiA9IHJlc29sdmVBc3NldChvcHRpb25zLCAnZGlyZWN0aXZlcycsIGRpck5hbWUpO1xuXG4gICAgICAgICAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgYXNzZXJ0QXNzZXQoZGlyRGVmLCAnZGlyZWN0aXZlJywgZGlyTmFtZSk7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBpZiAoZGlyRGVmKSB7XG4gICAgICAgICAgICAgICAgcHVzaERpcihkaXJOYW1lLCBkaXJEZWYpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gIH1cblxuICAvKipcbiAgICogUHVzaCBhIGRpcmVjdGl2ZS5cbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IGRpck5hbWVcbiAgICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IGRlZlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IFtpbnRlcnBdXG4gICAqL1xuXG4gIGZ1bmN0aW9uIHB1c2hEaXIoZGlyTmFtZSwgZGVmLCBpbnRlcnApIHtcbiAgICB2YXIgcGFyc2VkID0gcGFyc2VEaXJlY3RpdmUodmFsdWUpO1xuICAgIGRpcnMucHVzaCh7XG4gICAgICBuYW1lOiBkaXJOYW1lLFxuICAgICAgYXR0cjogcmF3TmFtZSxcbiAgICAgIHJhdzogcmF3VmFsdWUsXG4gICAgICBkZWY6IGRlZixcbiAgICAgIGFyZzogYXJnLFxuICAgICAgbW9kaWZpZXJzOiBtb2RpZmllcnMsXG4gICAgICBleHByZXNzaW9uOiBwYXJzZWQuZXhwcmVzc2lvbixcbiAgICAgIGZpbHRlcnM6IHBhcnNlZC5maWx0ZXJzLFxuICAgICAgaW50ZXJwOiBpbnRlcnBcbiAgICB9KTtcbiAgfVxuXG4gIGlmIChkaXJzLmxlbmd0aCkge1xuICAgIHJldHVybiBtYWtlTm9kZUxpbmtGbihkaXJzKTtcbiAgfVxufVxuXG4vKipcbiAqIFBhcnNlIG1vZGlmaWVycyBmcm9tIGRpcmVjdGl2ZSBhdHRyaWJ1dGUgbmFtZS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICogQHJldHVybiB7T2JqZWN0fVxuICovXG5cbmZ1bmN0aW9uIHBhcnNlTW9kaWZpZXJzKG5hbWUpIHtcbiAgdmFyIHJlcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gIHZhciBtYXRjaCA9IG5hbWUubWF0Y2gobW9kaWZpZXJSRSk7XG4gIGlmIChtYXRjaCkge1xuICAgIHZhciBpID0gbWF0Y2gubGVuZ3RoO1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIHJlc1ttYXRjaFtpXS5zbGljZSgxKV0gPSB0cnVlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzO1xufVxuXG4vKipcbiAqIEJ1aWxkIGEgbGluayBmdW5jdGlvbiBmb3IgYWxsIGRpcmVjdGl2ZXMgb24gYSBzaW5nbGUgbm9kZS5cbiAqXG4gKiBAcGFyYW0ge0FycmF5fSBkaXJlY3RpdmVzXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn0gZGlyZWN0aXZlc0xpbmtGblxuICovXG5cbmZ1bmN0aW9uIG1ha2VOb2RlTGlua0ZuKGRpcmVjdGl2ZXMpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIG5vZGVMaW5rRm4odm0sIGVsLCBob3N0LCBzY29wZSwgZnJhZykge1xuICAgIC8vIHJldmVyc2UgYXBwbHkgYmVjYXVzZSBpdCdzIHNvcnRlZCBsb3cgdG8gaGlnaFxuICAgIHZhciBpID0gZGlyZWN0aXZlcy5sZW5ndGg7XG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgdm0uX2JpbmREaXIoZGlyZWN0aXZlc1tpXSwgZWwsIGhvc3QsIHNjb3BlLCBmcmFnKTtcbiAgICB9XG4gIH07XG59XG5cbnZhciBzcGVjaWFsQ2hhclJFID0gL1teXFx3XFwtOlxcLl0vO1xuXG4vKipcbiAqIFByb2Nlc3MgYW4gZWxlbWVudCBvciBhIERvY3VtZW50RnJhZ21lbnQgYmFzZWQgb24gYVxuICogaW5zdGFuY2Ugb3B0aW9uIG9iamVjdC4gVGhpcyBhbGxvd3MgdXMgdG8gdHJhbnNjbHVkZVxuICogYSB0ZW1wbGF0ZSBub2RlL2ZyYWdtZW50IGJlZm9yZSB0aGUgaW5zdGFuY2UgaXMgY3JlYXRlZCxcbiAqIHNvIHRoZSBwcm9jZXNzZWQgZnJhZ21lbnQgY2FuIHRoZW4gYmUgY2xvbmVkIGFuZCByZXVzZWRcbiAqIGluIHYtZm9yLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtFbGVtZW50fERvY3VtZW50RnJhZ21lbnR9XG4gKi9cblxuZnVuY3Rpb24gdHJhbnNjbHVkZShlbCwgb3B0aW9ucykge1xuICAvLyBleHRyYWN0IGNvbnRhaW5lciBhdHRyaWJ1dGVzIHRvIHBhc3MgdGhlbSBkb3duXG4gIC8vIHRvIGNvbXBpbGVyLCBiZWNhdXNlIHRoZXkgbmVlZCB0byBiZSBjb21waWxlZCBpblxuICAvLyBwYXJlbnQgc2NvcGUuIHdlIGFyZSBtdXRhdGluZyB0aGUgb3B0aW9ucyBvYmplY3QgaGVyZVxuICAvLyBhc3N1bWluZyB0aGUgc2FtZSBvYmplY3Qgd2lsbCBiZSB1c2VkIGZvciBjb21waWxlXG4gIC8vIHJpZ2h0IGFmdGVyIHRoaXMuXG4gIGlmIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5fY29udGFpbmVyQXR0cnMgPSBleHRyYWN0QXR0cnMoZWwpO1xuICB9XG4gIC8vIGZvciB0ZW1wbGF0ZSB0YWdzLCB3aGF0IHdlIHdhbnQgaXMgaXRzIGNvbnRlbnQgYXNcbiAgLy8gYSBkb2N1bWVudEZyYWdtZW50IChmb3IgZnJhZ21lbnQgaW5zdGFuY2VzKVxuICBpZiAoaXNUZW1wbGF0ZShlbCkpIHtcbiAgICBlbCA9IHBhcnNlVGVtcGxhdGUoZWwpO1xuICB9XG4gIGlmIChvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMuX2FzQ29tcG9uZW50ICYmICFvcHRpb25zLnRlbXBsYXRlKSB7XG4gICAgICBvcHRpb25zLnRlbXBsYXRlID0gJzxzbG90Pjwvc2xvdD4nO1xuICAgIH1cbiAgICBpZiAob3B0aW9ucy50ZW1wbGF0ZSkge1xuICAgICAgb3B0aW9ucy5fY29udGVudCA9IGV4dHJhY3RDb250ZW50KGVsKTtcbiAgICAgIGVsID0gdHJhbnNjbHVkZVRlbXBsYXRlKGVsLCBvcHRpb25zKTtcbiAgICB9XG4gIH1cbiAgaWYgKGVsIGluc3RhbmNlb2YgRG9jdW1lbnRGcmFnbWVudCkge1xuICAgIC8vIGFuY2hvcnMgZm9yIGZyYWdtZW50IGluc3RhbmNlXG4gICAgLy8gcGFzc2luZyBpbiBgcGVyc2lzdDogdHJ1ZWAgdG8gYXZvaWQgdGhlbSBiZWluZ1xuICAgIC8vIGRpc2NhcmRlZCBieSBJRSBkdXJpbmcgdGVtcGxhdGUgY2xvbmluZ1xuICAgIHByZXBlbmQoY3JlYXRlQW5jaG9yKCd2LXN0YXJ0JywgdHJ1ZSksIGVsKTtcbiAgICBlbC5hcHBlbmRDaGlsZChjcmVhdGVBbmNob3IoJ3YtZW5kJywgdHJ1ZSkpO1xuICB9XG4gIHJldHVybiBlbDtcbn1cblxuLyoqXG4gKiBQcm9jZXNzIHRoZSB0ZW1wbGF0ZSBvcHRpb24uXG4gKiBJZiB0aGUgcmVwbGFjZSBvcHRpb24gaXMgdHJ1ZSB0aGlzIHdpbGwgc3dhcCB0aGUgJGVsLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtFbGVtZW50fERvY3VtZW50RnJhZ21lbnR9XG4gKi9cblxuZnVuY3Rpb24gdHJhbnNjbHVkZVRlbXBsYXRlKGVsLCBvcHRpb25zKSB7XG4gIHZhciB0ZW1wbGF0ZSA9IG9wdGlvbnMudGVtcGxhdGU7XG4gIHZhciBmcmFnID0gcGFyc2VUZW1wbGF0ZSh0ZW1wbGF0ZSwgdHJ1ZSk7XG4gIGlmIChmcmFnKSB7XG4gICAgdmFyIHJlcGxhY2VyID0gZnJhZy5maXJzdENoaWxkO1xuICAgIHZhciB0YWcgPSByZXBsYWNlci50YWdOYW1lICYmIHJlcGxhY2VyLnRhZ05hbWUudG9Mb3dlckNhc2UoKTtcbiAgICBpZiAob3B0aW9ucy5yZXBsYWNlKSB7XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgIGlmIChlbCA9PT0gZG9jdW1lbnQuYm9keSkge1xuICAgICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHdhcm4oJ1lvdSBhcmUgbW91bnRpbmcgYW4gaW5zdGFuY2Ugd2l0aCBhIHRlbXBsYXRlIHRvICcgKyAnPGJvZHk+LiBUaGlzIHdpbGwgcmVwbGFjZSA8Ym9keT4gZW50aXJlbHkuIFlvdSAnICsgJ3Nob3VsZCBwcm9iYWJseSB1c2UgYHJlcGxhY2U6IGZhbHNlYCBoZXJlLicpO1xuICAgICAgfVxuICAgICAgLy8gdGhlcmUgYXJlIG1hbnkgY2FzZXMgd2hlcmUgdGhlIGluc3RhbmNlIG11c3RcbiAgICAgIC8vIGJlY29tZSBhIGZyYWdtZW50IGluc3RhbmNlOiBiYXNpY2FsbHkgYW55dGhpbmcgdGhhdFxuICAgICAgLy8gY2FuIGNyZWF0ZSBtb3JlIHRoYW4gMSByb290IG5vZGVzLlxuICAgICAgaWYgKFxuICAgICAgLy8gbXVsdGktY2hpbGRyZW4gdGVtcGxhdGVcbiAgICAgIGZyYWcuY2hpbGROb2Rlcy5sZW5ndGggPiAxIHx8XG4gICAgICAvLyBub24tZWxlbWVudCB0ZW1wbGF0ZVxuICAgICAgcmVwbGFjZXIubm9kZVR5cGUgIT09IDEgfHxcbiAgICAgIC8vIHNpbmdsZSBuZXN0ZWQgY29tcG9uZW50XG4gICAgICB0YWcgPT09ICdjb21wb25lbnQnIHx8IHJlc29sdmVBc3NldChvcHRpb25zLCAnY29tcG9uZW50cycsIHRhZykgfHwgaGFzQmluZEF0dHIocmVwbGFjZXIsICdpcycpIHx8XG4gICAgICAvLyBlbGVtZW50IGRpcmVjdGl2ZVxuICAgICAgcmVzb2x2ZUFzc2V0KG9wdGlvbnMsICdlbGVtZW50RGlyZWN0aXZlcycsIHRhZykgfHxcbiAgICAgIC8vIGZvciBibG9ja1xuICAgICAgcmVwbGFjZXIuaGFzQXR0cmlidXRlKCd2LWZvcicpIHx8XG4gICAgICAvLyBpZiBibG9ja1xuICAgICAgcmVwbGFjZXIuaGFzQXR0cmlidXRlKCd2LWlmJykpIHtcbiAgICAgICAgcmV0dXJuIGZyYWc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvcHRpb25zLl9yZXBsYWNlckF0dHJzID0gZXh0cmFjdEF0dHJzKHJlcGxhY2VyKTtcbiAgICAgICAgbWVyZ2VBdHRycyhlbCwgcmVwbGFjZXIpO1xuICAgICAgICByZXR1cm4gcmVwbGFjZXI7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGVsLmFwcGVuZENoaWxkKGZyYWcpO1xuICAgICAgcmV0dXJuIGVsO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHdhcm4oJ0ludmFsaWQgdGVtcGxhdGUgb3B0aW9uOiAnICsgdGVtcGxhdGUpO1xuICB9XG59XG5cbi8qKlxuICogSGVscGVyIHRvIGV4dHJhY3QgYSBjb21wb25lbnQgY29udGFpbmVyJ3MgYXR0cmlidXRlc1xuICogaW50byBhIHBsYWluIG9iamVjdCBhcnJheS5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKiBAcmV0dXJuIHtBcnJheX1cbiAqL1xuXG5mdW5jdGlvbiBleHRyYWN0QXR0cnMoZWwpIHtcbiAgaWYgKGVsLm5vZGVUeXBlID09PSAxICYmIGVsLmhhc0F0dHJpYnV0ZXMoKSkge1xuICAgIHJldHVybiB0b0FycmF5KGVsLmF0dHJpYnV0ZXMpO1xuICB9XG59XG5cbi8qKlxuICogTWVyZ2UgdGhlIGF0dHJpYnV0ZXMgb2YgdHdvIGVsZW1lbnRzLCBhbmQgbWFrZSBzdXJlXG4gKiB0aGUgY2xhc3MgbmFtZXMgYXJlIG1lcmdlZCBwcm9wZXJseS5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGZyb21cbiAqIEBwYXJhbSB7RWxlbWVudH0gdG9cbiAqL1xuXG5mdW5jdGlvbiBtZXJnZUF0dHJzKGZyb20sIHRvKSB7XG4gIHZhciBhdHRycyA9IGZyb20uYXR0cmlidXRlcztcbiAgdmFyIGkgPSBhdHRycy5sZW5ndGg7XG4gIHZhciBuYW1lLCB2YWx1ZTtcbiAgd2hpbGUgKGktLSkge1xuICAgIG5hbWUgPSBhdHRyc1tpXS5uYW1lO1xuICAgIHZhbHVlID0gYXR0cnNbaV0udmFsdWU7XG4gICAgaWYgKCF0by5oYXNBdHRyaWJ1dGUobmFtZSkgJiYgIXNwZWNpYWxDaGFyUkUudGVzdChuYW1lKSkge1xuICAgICAgdG8uc2V0QXR0cmlidXRlKG5hbWUsIHZhbHVlKTtcbiAgICB9IGVsc2UgaWYgKG5hbWUgPT09ICdjbGFzcycpIHtcbiAgICAgIHZhbHVlLnNwbGl0KC9cXHMrLykuZm9yRWFjaChmdW5jdGlvbiAoY2xzKSB7XG4gICAgICAgIGFkZENsYXNzKHRvLCBjbHMpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG5cbnZhciBjb21waWxlciA9IE9iamVjdC5mcmVlemUoe1xuXHRjb21waWxlOiBjb21waWxlLFxuXHRjb21waWxlQW5kTGlua1Byb3BzOiBjb21waWxlQW5kTGlua1Byb3BzLFxuXHRjb21waWxlUm9vdDogY29tcGlsZVJvb3QsXG5cdHRyYW5zY2x1ZGU6IHRyYW5zY2x1ZGVcbn0pO1xuXG5mdW5jdGlvbiBzdGF0ZU1peGluIChWdWUpIHtcblxuICAvKipcbiAgICogQWNjZXNzb3IgZm9yIGAkZGF0YWAgcHJvcGVydHksIHNpbmNlIHNldHRpbmcgJGRhdGFcbiAgICogcmVxdWlyZXMgb2JzZXJ2aW5nIHRoZSBuZXcgb2JqZWN0IGFuZCB1cGRhdGluZ1xuICAgKiBwcm94aWVkIHByb3BlcnRpZXMuXG4gICAqL1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShWdWUucHJvdG90eXBlLCAnJGRhdGEnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fZGF0YTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KG5ld0RhdGEpIHtcbiAgICAgIGlmIChuZXdEYXRhICE9PSB0aGlzLl9kYXRhKSB7XG4gICAgICAgIHRoaXMuX3NldERhdGEobmV3RGF0YSk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICAvKipcbiAgICogU2V0dXAgdGhlIHNjb3BlIG9mIGFuIGluc3RhbmNlLCB3aGljaCBjb250YWluczpcbiAgICogLSBvYnNlcnZlZCBkYXRhXG4gICAqIC0gY29tcHV0ZWQgcHJvcGVydGllc1xuICAgKiAtIHVzZXIgbWV0aG9kc1xuICAgKiAtIG1ldGEgcHJvcGVydGllc1xuICAgKi9cblxuICBWdWUucHJvdG90eXBlLl9pbml0U3RhdGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5faW5pdFByb3BzKCk7XG4gICAgdGhpcy5faW5pdE1ldGEoKTtcbiAgICB0aGlzLl9pbml0TWV0aG9kcygpO1xuICAgIHRoaXMuX2luaXREYXRhKCk7XG4gICAgdGhpcy5faW5pdENvbXB1dGVkKCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIEluaXRpYWxpemUgcHJvcHMuXG4gICAqL1xuXG4gIFZ1ZS5wcm90b3R5cGUuX2luaXRQcm9wcyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgb3B0aW9ucyA9IHRoaXMuJG9wdGlvbnM7XG4gICAgdmFyIGVsID0gb3B0aW9ucy5lbDtcbiAgICB2YXIgcHJvcHMgPSBvcHRpb25zLnByb3BzO1xuICAgIGlmIChwcm9wcyAmJiAhZWwpIHtcbiAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgd2FybignUHJvcHMgd2lsbCBub3QgYmUgY29tcGlsZWQgaWYgbm8gYGVsYCBvcHRpb24gaXMgJyArICdwcm92aWRlZCBhdCBpbnN0YW50aWF0aW9uLicpO1xuICAgIH1cbiAgICAvLyBtYWtlIHN1cmUgdG8gY29udmVydCBzdHJpbmcgc2VsZWN0b3JzIGludG8gZWxlbWVudCBub3dcbiAgICBlbCA9IG9wdGlvbnMuZWwgPSBxdWVyeShlbCk7XG4gICAgdGhpcy5fcHJvcHNVbmxpbmtGbiA9IGVsICYmIGVsLm5vZGVUeXBlID09PSAxICYmIHByb3BzXG4gICAgLy8gcHJvcHMgbXVzdCBiZSBsaW5rZWQgaW4gcHJvcGVyIHNjb3BlIGlmIGluc2lkZSB2LWZvclxuICAgID8gY29tcGlsZUFuZExpbmtQcm9wcyh0aGlzLCBlbCwgcHJvcHMsIHRoaXMuX3Njb3BlKSA6IG51bGw7XG4gIH07XG5cbiAgLyoqXG4gICAqIEluaXRpYWxpemUgdGhlIGRhdGEuXG4gICAqL1xuXG4gIFZ1ZS5wcm90b3R5cGUuX2luaXREYXRhID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBwcm9wc0RhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHZhciBvcHRpb25zRGF0YUZuID0gdGhpcy4kb3B0aW9ucy5kYXRhO1xuICAgIHZhciBvcHRpb25zRGF0YSA9IG9wdGlvbnNEYXRhRm4gJiYgb3B0aW9uc0RhdGFGbigpO1xuICAgIGlmIChvcHRpb25zRGF0YSkge1xuICAgICAgdGhpcy5fZGF0YSA9IG9wdGlvbnNEYXRhO1xuICAgICAgZm9yICh2YXIgcHJvcCBpbiBwcm9wc0RhdGEpIHtcbiAgICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgaGFzT3duKG9wdGlvbnNEYXRhLCBwcm9wKSkge1xuICAgICAgICAgIHdhcm4oJ0RhdGEgZmllbGQgXCInICsgcHJvcCArICdcIiBpcyBhbHJlYWR5IGRlZmluZWQgJyArICdhcyBhIHByb3AuIFVzZSBwcm9wIGRlZmF1bHQgdmFsdWUgaW5zdGVhZC4nKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5fcHJvcHNbcHJvcF0ucmF3ICE9PSBudWxsIHx8ICFoYXNPd24ob3B0aW9uc0RhdGEsIHByb3ApKSB7XG4gICAgICAgICAgc2V0KG9wdGlvbnNEYXRhLCBwcm9wLCBwcm9wc0RhdGFbcHJvcF0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHZhciBkYXRhID0gdGhpcy5fZGF0YTtcbiAgICAvLyBwcm94eSBkYXRhIG9uIGluc3RhbmNlXG4gICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhkYXRhKTtcbiAgICB2YXIgaSwga2V5O1xuICAgIGkgPSBrZXlzLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBrZXkgPSBrZXlzW2ldO1xuICAgICAgdGhpcy5fcHJveHkoa2V5KTtcbiAgICB9XG4gICAgLy8gb2JzZXJ2ZSBkYXRhXG4gICAgb2JzZXJ2ZShkYXRhLCB0aGlzKTtcbiAgfTtcblxuICAvKipcbiAgICogU3dhcCB0aGUgaW5zdGFuY2UncyAkZGF0YS4gQ2FsbGVkIGluICRkYXRhJ3Mgc2V0dGVyLlxuICAgKlxuICAgKiBAcGFyYW0ge09iamVjdH0gbmV3RGF0YVxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLl9zZXREYXRhID0gZnVuY3Rpb24gKG5ld0RhdGEpIHtcbiAgICBuZXdEYXRhID0gbmV3RGF0YSB8fCB7fTtcbiAgICB2YXIgb2xkRGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgdGhpcy5fZGF0YSA9IG5ld0RhdGE7XG4gICAgdmFyIGtleXMsIGtleSwgaTtcbiAgICAvLyB1bnByb3h5IGtleXMgbm90IHByZXNlbnQgaW4gbmV3IGRhdGFcbiAgICBrZXlzID0gT2JqZWN0LmtleXMob2xkRGF0YSk7XG4gICAgaSA9IGtleXMubGVuZ3RoO1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGtleSA9IGtleXNbaV07XG4gICAgICBpZiAoIShrZXkgaW4gbmV3RGF0YSkpIHtcbiAgICAgICAgdGhpcy5fdW5wcm94eShrZXkpO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBwcm94eSBrZXlzIG5vdCBhbHJlYWR5IHByb3hpZWQsXG4gICAgLy8gYW5kIHRyaWdnZXIgY2hhbmdlIGZvciBjaGFuZ2VkIHZhbHVlc1xuICAgIGtleXMgPSBPYmplY3Qua2V5cyhuZXdEYXRhKTtcbiAgICBpID0ga2V5cy5sZW5ndGg7XG4gICAgd2hpbGUgKGktLSkge1xuICAgICAga2V5ID0ga2V5c1tpXTtcbiAgICAgIGlmICghaGFzT3duKHRoaXMsIGtleSkpIHtcbiAgICAgICAgLy8gbmV3IHByb3BlcnR5XG4gICAgICAgIHRoaXMuX3Byb3h5KGtleSk7XG4gICAgICB9XG4gICAgfVxuICAgIG9sZERhdGEuX19vYl9fLnJlbW92ZVZtKHRoaXMpO1xuICAgIG9ic2VydmUobmV3RGF0YSwgdGhpcyk7XG4gICAgdGhpcy5fZGlnZXN0KCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFByb3h5IGEgcHJvcGVydHksIHNvIHRoYXRcbiAgICogdm0ucHJvcCA9PT0gdm0uX2RhdGEucHJvcFxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30ga2V5XG4gICAqL1xuXG4gIFZ1ZS5wcm90b3R5cGUuX3Byb3h5ID0gZnVuY3Rpb24gKGtleSkge1xuICAgIGlmICghaXNSZXNlcnZlZChrZXkpKSB7XG4gICAgICAvLyBuZWVkIHRvIHN0b3JlIHJlZiB0byBzZWxmIGhlcmVcbiAgICAgIC8vIGJlY2F1c2UgdGhlc2UgZ2V0dGVyL3NldHRlcnMgbWlnaHRcbiAgICAgIC8vIGJlIGNhbGxlZCBieSBjaGlsZCBzY29wZXMgdmlhXG4gICAgICAvLyBwcm90b3R5cGUgaW5oZXJpdGFuY2UuXG4gICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoc2VsZiwga2V5LCB7XG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiBwcm94eUdldHRlcigpIHtcbiAgICAgICAgICByZXR1cm4gc2VsZi5fZGF0YVtrZXldO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uIHByb3h5U2V0dGVyKHZhbCkge1xuICAgICAgICAgIHNlbGYuX2RhdGFba2V5XSA9IHZhbDtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBVbnByb3h5IGEgcHJvcGVydHkuXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBrZXlcbiAgICovXG5cbiAgVnVlLnByb3RvdHlwZS5fdW5wcm94eSA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICBpZiAoIWlzUmVzZXJ2ZWQoa2V5KSkge1xuICAgICAgZGVsZXRlIHRoaXNba2V5XTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIEZvcmNlIHVwZGF0ZSBvbiBldmVyeSB3YXRjaGVyIGluIHNjb3BlLlxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLl9kaWdlc3QgPSBmdW5jdGlvbiAoKSB7XG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLl93YXRjaGVycy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIHRoaXMuX3dhdGNoZXJzW2ldLnVwZGF0ZSh0cnVlKTsgLy8gc2hhbGxvdyB1cGRhdGVzXG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBTZXR1cCBjb21wdXRlZCBwcm9wZXJ0aWVzLiBUaGV5IGFyZSBlc3NlbnRpYWxseVxuICAgKiBzcGVjaWFsIGdldHRlci9zZXR0ZXJzXG4gICAqL1xuXG4gIGZ1bmN0aW9uIG5vb3AoKSB7fVxuICBWdWUucHJvdG90eXBlLl9pbml0Q29tcHV0ZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGNvbXB1dGVkID0gdGhpcy4kb3B0aW9ucy5jb21wdXRlZDtcbiAgICBpZiAoY29tcHV0ZWQpIHtcbiAgICAgIGZvciAodmFyIGtleSBpbiBjb21wdXRlZCkge1xuICAgICAgICB2YXIgdXNlckRlZiA9IGNvbXB1dGVkW2tleV07XG4gICAgICAgIHZhciBkZWYgPSB7XG4gICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKHR5cGVvZiB1c2VyRGVmID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgZGVmLmdldCA9IG1ha2VDb21wdXRlZEdldHRlcih1c2VyRGVmLCB0aGlzKTtcbiAgICAgICAgICBkZWYuc2V0ID0gbm9vcDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBkZWYuZ2V0ID0gdXNlckRlZi5nZXQgPyB1c2VyRGVmLmNhY2hlICE9PSBmYWxzZSA/IG1ha2VDb21wdXRlZEdldHRlcih1c2VyRGVmLmdldCwgdGhpcykgOiBiaW5kJDEodXNlckRlZi5nZXQsIHRoaXMpIDogbm9vcDtcbiAgICAgICAgICBkZWYuc2V0ID0gdXNlckRlZi5zZXQgPyBiaW5kJDEodXNlckRlZi5zZXQsIHRoaXMpIDogbm9vcDtcbiAgICAgICAgfVxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywga2V5LCBkZWYpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICBmdW5jdGlvbiBtYWtlQ29tcHV0ZWRHZXR0ZXIoZ2V0dGVyLCBvd25lcikge1xuICAgIHZhciB3YXRjaGVyID0gbmV3IFdhdGNoZXIob3duZXIsIGdldHRlciwgbnVsbCwge1xuICAgICAgbGF6eTogdHJ1ZVxuICAgIH0pO1xuICAgIHJldHVybiBmdW5jdGlvbiBjb21wdXRlZEdldHRlcigpIHtcbiAgICAgIGlmICh3YXRjaGVyLmRpcnR5KSB7XG4gICAgICAgIHdhdGNoZXIuZXZhbHVhdGUoKTtcbiAgICAgIH1cbiAgICAgIGlmIChEZXAudGFyZ2V0KSB7XG4gICAgICAgIHdhdGNoZXIuZGVwZW5kKCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gd2F0Y2hlci52YWx1ZTtcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHVwIGluc3RhbmNlIG1ldGhvZHMuIE1ldGhvZHMgbXVzdCBiZSBib3VuZCB0byB0aGVcbiAgICogaW5zdGFuY2Ugc2luY2UgdGhleSBtaWdodCBiZSBwYXNzZWQgZG93biBhcyBhIHByb3AgdG9cbiAgICogY2hpbGQgY29tcG9uZW50cy5cbiAgICovXG5cbiAgVnVlLnByb3RvdHlwZS5faW5pdE1ldGhvZHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIG1ldGhvZHMgPSB0aGlzLiRvcHRpb25zLm1ldGhvZHM7XG4gICAgaWYgKG1ldGhvZHMpIHtcbiAgICAgIGZvciAodmFyIGtleSBpbiBtZXRob2RzKSB7XG4gICAgICAgIHRoaXNba2V5XSA9IGJpbmQkMShtZXRob2RzW2tleV0sIHRoaXMpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogSW5pdGlhbGl6ZSBtZXRhIGluZm9ybWF0aW9uIGxpa2UgJGluZGV4LCAka2V5ICYgJHZhbHVlLlxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLl9pbml0TWV0YSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbWV0YXMgPSB0aGlzLiRvcHRpb25zLl9tZXRhO1xuICAgIGlmIChtZXRhcykge1xuICAgICAgZm9yICh2YXIga2V5IGluIG1ldGFzKSB7XG4gICAgICAgIGRlZmluZVJlYWN0aXZlKHRoaXMsIGtleSwgbWV0YXNba2V5XSk7XG4gICAgICB9XG4gICAgfVxuICB9O1xufVxuXG52YXIgZXZlbnRSRSA9IC9edi1vbjp8XkAvO1xuXG5mdW5jdGlvbiBldmVudHNNaXhpbiAoVnVlKSB7XG5cbiAgLyoqXG4gICAqIFNldHVwIHRoZSBpbnN0YW5jZSdzIG9wdGlvbiBldmVudHMgJiB3YXRjaGVycy5cbiAgICogSWYgdGhlIHZhbHVlIGlzIGEgc3RyaW5nLCB3ZSBwdWxsIGl0IGZyb20gdGhlXG4gICAqIGluc3RhbmNlJ3MgbWV0aG9kcyBieSBuYW1lLlxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLl9pbml0RXZlbnRzID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBvcHRpb25zID0gdGhpcy4kb3B0aW9ucztcbiAgICBpZiAob3B0aW9ucy5fYXNDb21wb25lbnQpIHtcbiAgICAgIHJlZ2lzdGVyQ29tcG9uZW50RXZlbnRzKHRoaXMsIG9wdGlvbnMuZWwpO1xuICAgIH1cbiAgICByZWdpc3RlckNhbGxiYWNrcyh0aGlzLCAnJG9uJywgb3B0aW9ucy5ldmVudHMpO1xuICAgIHJlZ2lzdGVyQ2FsbGJhY2tzKHRoaXMsICckd2F0Y2gnLCBvcHRpb25zLndhdGNoKTtcbiAgfTtcblxuICAvKipcbiAgICogUmVnaXN0ZXIgdi1vbiBldmVudHMgb24gYSBjaGlsZCBjb21wb25lbnRcbiAgICpcbiAgICogQHBhcmFtIHtWdWV9IHZtXG4gICAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAgICovXG5cbiAgZnVuY3Rpb24gcmVnaXN0ZXJDb21wb25lbnRFdmVudHModm0sIGVsKSB7XG4gICAgdmFyIGF0dHJzID0gZWwuYXR0cmlidXRlcztcbiAgICB2YXIgbmFtZSwgaGFuZGxlcjtcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IGF0dHJzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgbmFtZSA9IGF0dHJzW2ldLm5hbWU7XG4gICAgICBpZiAoZXZlbnRSRS50ZXN0KG5hbWUpKSB7XG4gICAgICAgIG5hbWUgPSBuYW1lLnJlcGxhY2UoZXZlbnRSRSwgJycpO1xuICAgICAgICBoYW5kbGVyID0gKHZtLl9zY29wZSB8fCB2bS5fY29udGV4dCkuJGV2YWwoYXR0cnNbaV0udmFsdWUsIHRydWUpO1xuICAgICAgICB2bS4kb24obmFtZS5yZXBsYWNlKGV2ZW50UkUpLCBoYW5kbGVyKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgY2FsbGJhY2tzIGZvciBvcHRpb24gZXZlbnRzIGFuZCB3YXRjaGVycy5cbiAgICpcbiAgICogQHBhcmFtIHtWdWV9IHZtXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBhY3Rpb25cbiAgICogQHBhcmFtIHtPYmplY3R9IGhhc2hcbiAgICovXG5cbiAgZnVuY3Rpb24gcmVnaXN0ZXJDYWxsYmFja3Modm0sIGFjdGlvbiwgaGFzaCkge1xuICAgIGlmICghaGFzaCkgcmV0dXJuO1xuICAgIHZhciBoYW5kbGVycywga2V5LCBpLCBqO1xuICAgIGZvciAoa2V5IGluIGhhc2gpIHtcbiAgICAgIGhhbmRsZXJzID0gaGFzaFtrZXldO1xuICAgICAgaWYgKGlzQXJyYXkoaGFuZGxlcnMpKSB7XG4gICAgICAgIGZvciAoaSA9IDAsIGogPSBoYW5kbGVycy5sZW5ndGg7IGkgPCBqOyBpKyspIHtcbiAgICAgICAgICByZWdpc3Rlcih2bSwgYWN0aW9uLCBrZXksIGhhbmRsZXJzW2ldKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVnaXN0ZXIodm0sIGFjdGlvbiwga2V5LCBoYW5kbGVycyk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEhlbHBlciB0byByZWdpc3RlciBhbiBldmVudC93YXRjaCBjYWxsYmFjay5cbiAgICpcbiAgICogQHBhcmFtIHtWdWV9IHZtXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBhY3Rpb25cbiAgICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufFN0cmluZ3xPYmplY3R9IGhhbmRsZXJcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICAgKi9cblxuICBmdW5jdGlvbiByZWdpc3Rlcih2bSwgYWN0aW9uLCBrZXksIGhhbmRsZXIsIG9wdGlvbnMpIHtcbiAgICB2YXIgdHlwZSA9IHR5cGVvZiBoYW5kbGVyO1xuICAgIGlmICh0eXBlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICB2bVthY3Rpb25dKGtleSwgaGFuZGxlciwgb3B0aW9ucyk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnc3RyaW5nJykge1xuICAgICAgdmFyIG1ldGhvZHMgPSB2bS4kb3B0aW9ucy5tZXRob2RzO1xuICAgICAgdmFyIG1ldGhvZCA9IG1ldGhvZHMgJiYgbWV0aG9kc1toYW5kbGVyXTtcbiAgICAgIGlmIChtZXRob2QpIHtcbiAgICAgICAgdm1bYWN0aW9uXShrZXksIG1ldGhvZCwgb3B0aW9ucyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHdhcm4oJ1Vua25vd24gbWV0aG9kOiBcIicgKyBoYW5kbGVyICsgJ1wiIHdoZW4gJyArICdyZWdpc3RlcmluZyBjYWxsYmFjayBmb3IgJyArIGFjdGlvbiArICc6IFwiJyArIGtleSArICdcIi4nKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGhhbmRsZXIgJiYgdHlwZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIHJlZ2lzdGVyKHZtLCBhY3Rpb24sIGtleSwgaGFuZGxlci5oYW5kbGVyLCBoYW5kbGVyKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU2V0dXAgcmVjdXJzaXZlIGF0dGFjaGVkL2RldGFjaGVkIGNhbGxzXG4gICAqL1xuXG4gIFZ1ZS5wcm90b3R5cGUuX2luaXRET01Ib29rcyA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLiRvbignaG9vazphdHRhY2hlZCcsIG9uQXR0YWNoZWQpO1xuICAgIHRoaXMuJG9uKCdob29rOmRldGFjaGVkJywgb25EZXRhY2hlZCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIENhbGxiYWNrIHRvIHJlY3Vyc2l2ZWx5IGNhbGwgYXR0YWNoZWQgaG9vayBvbiBjaGlsZHJlblxuICAgKi9cblxuICBmdW5jdGlvbiBvbkF0dGFjaGVkKCkge1xuICAgIGlmICghdGhpcy5faXNBdHRhY2hlZCkge1xuICAgICAgdGhpcy5faXNBdHRhY2hlZCA9IHRydWU7XG4gICAgICB0aGlzLiRjaGlsZHJlbi5mb3JFYWNoKGNhbGxBdHRhY2gpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJdGVyYXRvciB0byBjYWxsIGF0dGFjaGVkIGhvb2tcbiAgICpcbiAgICogQHBhcmFtIHtWdWV9IGNoaWxkXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGNhbGxBdHRhY2goY2hpbGQpIHtcbiAgICBpZiAoIWNoaWxkLl9pc0F0dGFjaGVkICYmIGluRG9jKGNoaWxkLiRlbCkpIHtcbiAgICAgIGNoaWxkLl9jYWxsSG9vaygnYXR0YWNoZWQnKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGJhY2sgdG8gcmVjdXJzaXZlbHkgY2FsbCBkZXRhY2hlZCBob29rIG9uIGNoaWxkcmVuXG4gICAqL1xuXG4gIGZ1bmN0aW9uIG9uRGV0YWNoZWQoKSB7XG4gICAgaWYgKHRoaXMuX2lzQXR0YWNoZWQpIHtcbiAgICAgIHRoaXMuX2lzQXR0YWNoZWQgPSBmYWxzZTtcbiAgICAgIHRoaXMuJGNoaWxkcmVuLmZvckVhY2goY2FsbERldGFjaCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEl0ZXJhdG9yIHRvIGNhbGwgZGV0YWNoZWQgaG9va1xuICAgKlxuICAgKiBAcGFyYW0ge1Z1ZX0gY2hpbGRcbiAgICovXG5cbiAgZnVuY3Rpb24gY2FsbERldGFjaChjaGlsZCkge1xuICAgIGlmIChjaGlsZC5faXNBdHRhY2hlZCAmJiAhaW5Eb2MoY2hpbGQuJGVsKSkge1xuICAgICAgY2hpbGQuX2NhbGxIb29rKCdkZXRhY2hlZCcpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBUcmlnZ2VyIGFsbCBoYW5kbGVycyBmb3IgYSBob29rXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBob29rXG4gICAqL1xuXG4gIFZ1ZS5wcm90b3R5cGUuX2NhbGxIb29rID0gZnVuY3Rpb24gKGhvb2spIHtcbiAgICB0aGlzLiRlbWl0KCdwcmUtaG9vazonICsgaG9vayk7XG4gICAgdmFyIGhhbmRsZXJzID0gdGhpcy4kb3B0aW9uc1tob29rXTtcbiAgICBpZiAoaGFuZGxlcnMpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBqID0gaGFuZGxlcnMubGVuZ3RoOyBpIDwgajsgaSsrKSB7XG4gICAgICAgIGhhbmRsZXJzW2ldLmNhbGwodGhpcyk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuJGVtaXQoJ2hvb2s6JyArIGhvb2spO1xuICB9O1xufVxuXG5mdW5jdGlvbiBub29wKCkge31cblxuLyoqXG4gKiBBIGRpcmVjdGl2ZSBsaW5rcyBhIERPTSBlbGVtZW50IHdpdGggYSBwaWVjZSBvZiBkYXRhLFxuICogd2hpY2ggaXMgdGhlIHJlc3VsdCBvZiBldmFsdWF0aW5nIGFuIGV4cHJlc3Npb24uXG4gKiBJdCByZWdpc3RlcnMgYSB3YXRjaGVyIHdpdGggdGhlIGV4cHJlc3Npb24gYW5kIGNhbGxzXG4gKiB0aGUgRE9NIHVwZGF0ZSBmdW5jdGlvbiB3aGVuIGEgY2hhbmdlIGlzIHRyaWdnZXJlZC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICogQHBhcmFtIHtOb2RlfSBlbFxuICogQHBhcmFtIHtWdWV9IHZtXG4gKiBAcGFyYW0ge09iamVjdH0gZGVzY3JpcHRvclxuICogICAgICAgICAgICAgICAgIC0ge1N0cmluZ30gbmFtZVxuICogICAgICAgICAgICAgICAgIC0ge09iamVjdH0gZGVmXG4gKiAgICAgICAgICAgICAgICAgLSB7U3RyaW5nfSBleHByZXNzaW9uXG4gKiAgICAgICAgICAgICAgICAgLSB7QXJyYXk8T2JqZWN0Pn0gW2ZpbHRlcnNdXG4gKiAgICAgICAgICAgICAgICAgLSB7Qm9vbGVhbn0gbGl0ZXJhbFxuICogICAgICAgICAgICAgICAgIC0ge1N0cmluZ30gYXR0clxuICogICAgICAgICAgICAgICAgIC0ge1N0cmluZ30gcmF3XG4gKiBAcGFyYW0ge09iamVjdH0gZGVmIC0gZGlyZWN0aXZlIGRlZmluaXRpb24gb2JqZWN0XG4gKiBAcGFyYW0ge1Z1ZX0gW2hvc3RdIC0gdHJhbnNjbHVzaW9uIGhvc3QgY29tcG9uZW50XG4gKiBAcGFyYW0ge09iamVjdH0gW3Njb3BlXSAtIHYtZm9yIHNjb3BlXG4gKiBAcGFyYW0ge0ZyYWdtZW50fSBbZnJhZ10gLSBvd25lciBmcmFnbWVudFxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIERpcmVjdGl2ZShkZXNjcmlwdG9yLCB2bSwgZWwsIGhvc3QsIHNjb3BlLCBmcmFnKSB7XG4gIHRoaXMudm0gPSB2bTtcbiAgdGhpcy5lbCA9IGVsO1xuICAvLyBjb3B5IGRlc2NyaXB0b3IgcHJvcGVydGllc1xuICB0aGlzLmRlc2NyaXB0b3IgPSBkZXNjcmlwdG9yO1xuICB0aGlzLm5hbWUgPSBkZXNjcmlwdG9yLm5hbWU7XG4gIHRoaXMuZXhwcmVzc2lvbiA9IGRlc2NyaXB0b3IuZXhwcmVzc2lvbjtcbiAgdGhpcy5hcmcgPSBkZXNjcmlwdG9yLmFyZztcbiAgdGhpcy5tb2RpZmllcnMgPSBkZXNjcmlwdG9yLm1vZGlmaWVycztcbiAgdGhpcy5maWx0ZXJzID0gZGVzY3JpcHRvci5maWx0ZXJzO1xuICB0aGlzLmxpdGVyYWwgPSB0aGlzLm1vZGlmaWVycyAmJiB0aGlzLm1vZGlmaWVycy5saXRlcmFsO1xuICAvLyBwcml2YXRlXG4gIHRoaXMuX2xvY2tlZCA9IGZhbHNlO1xuICB0aGlzLl9ib3VuZCA9IGZhbHNlO1xuICB0aGlzLl9saXN0ZW5lcnMgPSBudWxsO1xuICAvLyBsaW5rIGNvbnRleHRcbiAgdGhpcy5faG9zdCA9IGhvc3Q7XG4gIHRoaXMuX3Njb3BlID0gc2NvcGU7XG4gIHRoaXMuX2ZyYWcgPSBmcmFnO1xuICAvLyBzdG9yZSBkaXJlY3RpdmVzIG9uIG5vZGUgaW4gZGV2IG1vZGVcbiAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgdGhpcy5lbCkge1xuICAgIHRoaXMuZWwuX3Z1ZV9kaXJlY3RpdmVzID0gdGhpcy5lbC5fdnVlX2RpcmVjdGl2ZXMgfHwgW107XG4gICAgdGhpcy5lbC5fdnVlX2RpcmVjdGl2ZXMucHVzaCh0aGlzKTtcbiAgfVxufVxuXG4vKipcbiAqIEluaXRpYWxpemUgdGhlIGRpcmVjdGl2ZSwgbWl4aW4gZGVmaW5pdGlvbiBwcm9wZXJ0aWVzLFxuICogc2V0dXAgdGhlIHdhdGNoZXIsIGNhbGwgZGVmaW5pdGlvbiBiaW5kKCkgYW5kIHVwZGF0ZSgpXG4gKiBpZiBwcmVzZW50LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBkZWZcbiAqL1xuXG5EaXJlY3RpdmUucHJvdG90eXBlLl9iaW5kID0gZnVuY3Rpb24gKCkge1xuICB2YXIgbmFtZSA9IHRoaXMubmFtZTtcbiAgdmFyIGRlc2NyaXB0b3IgPSB0aGlzLmRlc2NyaXB0b3I7XG5cbiAgLy8gcmVtb3ZlIGF0dHJpYnV0ZVxuICBpZiAoKG5hbWUgIT09ICdjbG9haycgfHwgdGhpcy52bS5faXNDb21waWxlZCkgJiYgdGhpcy5lbCAmJiB0aGlzLmVsLnJlbW92ZUF0dHJpYnV0ZSkge1xuICAgIHZhciBhdHRyID0gZGVzY3JpcHRvci5hdHRyIHx8ICd2LScgKyBuYW1lO1xuICAgIHRoaXMuZWwucmVtb3ZlQXR0cmlidXRlKGF0dHIpO1xuICB9XG5cbiAgLy8gY29weSBkZWYgcHJvcGVydGllc1xuICB2YXIgZGVmID0gZGVzY3JpcHRvci5kZWY7XG4gIGlmICh0eXBlb2YgZGVmID09PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhpcy51cGRhdGUgPSBkZWY7XG4gIH0gZWxzZSB7XG4gICAgZXh0ZW5kKHRoaXMsIGRlZik7XG4gIH1cblxuICAvLyBzZXR1cCBkaXJlY3RpdmUgcGFyYW1zXG4gIHRoaXMuX3NldHVwUGFyYW1zKCk7XG5cbiAgLy8gaW5pdGlhbCBiaW5kXG4gIGlmICh0aGlzLmJpbmQpIHtcbiAgICB0aGlzLmJpbmQoKTtcbiAgfVxuICB0aGlzLl9ib3VuZCA9IHRydWU7XG5cbiAgaWYgKHRoaXMubGl0ZXJhbCkge1xuICAgIHRoaXMudXBkYXRlICYmIHRoaXMudXBkYXRlKGRlc2NyaXB0b3IucmF3KTtcbiAgfSBlbHNlIGlmICgodGhpcy5leHByZXNzaW9uIHx8IHRoaXMubW9kaWZpZXJzKSAmJiAodGhpcy51cGRhdGUgfHwgdGhpcy50d29XYXkpICYmICF0aGlzLl9jaGVja1N0YXRlbWVudCgpKSB7XG4gICAgLy8gd3JhcHBlZCB1cGRhdGVyIGZvciBjb250ZXh0XG4gICAgdmFyIGRpciA9IHRoaXM7XG4gICAgaWYgKHRoaXMudXBkYXRlKSB7XG4gICAgICB0aGlzLl91cGRhdGUgPSBmdW5jdGlvbiAodmFsLCBvbGRWYWwpIHtcbiAgICAgICAgaWYgKCFkaXIuX2xvY2tlZCkge1xuICAgICAgICAgIGRpci51cGRhdGUodmFsLCBvbGRWYWwpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl91cGRhdGUgPSBub29wO1xuICAgIH1cbiAgICB2YXIgcHJlUHJvY2VzcyA9IHRoaXMuX3ByZVByb2Nlc3MgPyBiaW5kJDEodGhpcy5fcHJlUHJvY2VzcywgdGhpcykgOiBudWxsO1xuICAgIHZhciBwb3N0UHJvY2VzcyA9IHRoaXMuX3Bvc3RQcm9jZXNzID8gYmluZCQxKHRoaXMuX3Bvc3RQcm9jZXNzLCB0aGlzKSA6IG51bGw7XG4gICAgdmFyIHdhdGNoZXIgPSB0aGlzLl93YXRjaGVyID0gbmV3IFdhdGNoZXIodGhpcy52bSwgdGhpcy5leHByZXNzaW9uLCB0aGlzLl91cGRhdGUsIC8vIGNhbGxiYWNrXG4gICAge1xuICAgICAgZmlsdGVyczogdGhpcy5maWx0ZXJzLFxuICAgICAgdHdvV2F5OiB0aGlzLnR3b1dheSxcbiAgICAgIGRlZXA6IHRoaXMuZGVlcCxcbiAgICAgIHByZVByb2Nlc3M6IHByZVByb2Nlc3MsXG4gICAgICBwb3N0UHJvY2VzczogcG9zdFByb2Nlc3MsXG4gICAgICBzY29wZTogdGhpcy5fc2NvcGVcbiAgICB9KTtcbiAgICAvLyB2LW1vZGVsIHdpdGggaW5pdGFsIGlubGluZSB2YWx1ZSBuZWVkIHRvIHN5bmMgYmFjayB0b1xuICAgIC8vIG1vZGVsIGluc3RlYWQgb2YgdXBkYXRlIHRvIERPTSBvbiBpbml0LiBUaGV5IHdvdWxkXG4gICAgLy8gc2V0IHRoZSBhZnRlckJpbmQgaG9vayB0byBpbmRpY2F0ZSB0aGF0LlxuICAgIGlmICh0aGlzLmFmdGVyQmluZCkge1xuICAgICAgdGhpcy5hZnRlckJpbmQoKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMudXBkYXRlKSB7XG4gICAgICB0aGlzLnVwZGF0ZSh3YXRjaGVyLnZhbHVlKTtcbiAgICB9XG4gIH1cbn07XG5cbi8qKlxuICogU2V0dXAgYWxsIHBhcmFtIGF0dHJpYnV0ZXMsIGUuZy4gdHJhY2stYnksXG4gKiB0cmFuc2l0aW9uLW1vZGUsIGV0Yy4uLlxuICovXG5cbkRpcmVjdGl2ZS5wcm90b3R5cGUuX3NldHVwUGFyYW1zID0gZnVuY3Rpb24gKCkge1xuICBpZiAoIXRoaXMucGFyYW1zKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHZhciBwYXJhbXMgPSB0aGlzLnBhcmFtcztcbiAgLy8gc3dhcCB0aGUgcGFyYW1zIGFycmF5IHdpdGggYSBmcmVzaCBvYmplY3QuXG4gIHRoaXMucGFyYW1zID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgdmFyIGkgPSBwYXJhbXMubGVuZ3RoO1xuICB2YXIga2V5LCB2YWwsIG1hcHBlZEtleTtcbiAgd2hpbGUgKGktLSkge1xuICAgIGtleSA9IHBhcmFtc1tpXTtcbiAgICBtYXBwZWRLZXkgPSBjYW1lbGl6ZShrZXkpO1xuICAgIHZhbCA9IGdldEJpbmRBdHRyKHRoaXMuZWwsIGtleSk7XG4gICAgaWYgKHZhbCAhPSBudWxsKSB7XG4gICAgICAvLyBkeW5hbWljXG4gICAgICB0aGlzLl9zZXR1cFBhcmFtV2F0Y2hlcihtYXBwZWRLZXksIHZhbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIHN0YXRpY1xuICAgICAgdmFsID0gZ2V0QXR0cih0aGlzLmVsLCBrZXkpO1xuICAgICAgaWYgKHZhbCAhPSBudWxsKSB7XG4gICAgICAgIHRoaXMucGFyYW1zW21hcHBlZEtleV0gPSB2YWwgPT09ICcnID8gdHJ1ZSA6IHZhbDtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn07XG5cbi8qKlxuICogU2V0dXAgYSB3YXRjaGVyIGZvciBhIGR5bmFtaWMgcGFyYW0uXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICogQHBhcmFtIHtTdHJpbmd9IGV4cHJlc3Npb25cbiAqL1xuXG5EaXJlY3RpdmUucHJvdG90eXBlLl9zZXR1cFBhcmFtV2F0Y2hlciA9IGZ1bmN0aW9uIChrZXksIGV4cHJlc3Npb24pIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgY2FsbGVkID0gZmFsc2U7XG4gIHZhciB1bndhdGNoID0gKHRoaXMuX3Njb3BlIHx8IHRoaXMudm0pLiR3YXRjaChleHByZXNzaW9uLCBmdW5jdGlvbiAodmFsLCBvbGRWYWwpIHtcbiAgICBzZWxmLnBhcmFtc1trZXldID0gdmFsO1xuICAgIC8vIHNpbmNlIHdlIGFyZSBpbiBpbW1lZGlhdGUgbW9kZSxcbiAgICAvLyBvbmx5IGNhbGwgdGhlIHBhcmFtIGNoYW5nZSBjYWxsYmFja3MgaWYgdGhpcyBpcyBub3QgdGhlIGZpcnN0IHVwZGF0ZS5cbiAgICBpZiAoY2FsbGVkKSB7XG4gICAgICB2YXIgY2IgPSBzZWxmLnBhcmFtV2F0Y2hlcnMgJiYgc2VsZi5wYXJhbVdhdGNoZXJzW2tleV07XG4gICAgICBpZiAoY2IpIHtcbiAgICAgICAgY2IuY2FsbChzZWxmLCB2YWwsIG9sZFZhbCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNhbGxlZCA9IHRydWU7XG4gICAgfVxuICB9LCB7XG4gICAgaW1tZWRpYXRlOiB0cnVlLFxuICAgIHVzZXI6IGZhbHNlXG4gIH0pOyh0aGlzLl9wYXJhbVVud2F0Y2hGbnMgfHwgKHRoaXMuX3BhcmFtVW53YXRjaEZucyA9IFtdKSkucHVzaCh1bndhdGNoKTtcbn07XG5cbi8qKlxuICogQ2hlY2sgaWYgdGhlIGRpcmVjdGl2ZSBpcyBhIGZ1bmN0aW9uIGNhbGxlclxuICogYW5kIGlmIHRoZSBleHByZXNzaW9uIGlzIGEgY2FsbGFibGUgb25lLiBJZiBib3RoIHRydWUsXG4gKiB3ZSB3cmFwIHVwIHRoZSBleHByZXNzaW9uIGFuZCB1c2UgaXQgYXMgdGhlIGV2ZW50XG4gKiBoYW5kbGVyLlxuICpcbiAqIGUuZy4gb24tY2xpY2s9XCJhKytcIlxuICpcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cblxuRGlyZWN0aXZlLnByb3RvdHlwZS5fY2hlY2tTdGF0ZW1lbnQgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBleHByZXNzaW9uID0gdGhpcy5leHByZXNzaW9uO1xuICBpZiAoZXhwcmVzc2lvbiAmJiB0aGlzLmFjY2VwdFN0YXRlbWVudCAmJiAhaXNTaW1wbGVQYXRoKGV4cHJlc3Npb24pKSB7XG4gICAgdmFyIGZuID0gcGFyc2VFeHByZXNzaW9uKGV4cHJlc3Npb24pLmdldDtcbiAgICB2YXIgc2NvcGUgPSB0aGlzLl9zY29wZSB8fCB0aGlzLnZtO1xuICAgIHZhciBoYW5kbGVyID0gZnVuY3Rpb24gaGFuZGxlcihlKSB7XG4gICAgICBzY29wZS4kZXZlbnQgPSBlO1xuICAgICAgZm4uY2FsbChzY29wZSwgc2NvcGUpO1xuICAgICAgc2NvcGUuJGV2ZW50ID0gbnVsbDtcbiAgICB9O1xuICAgIGlmICh0aGlzLmZpbHRlcnMpIHtcbiAgICAgIGhhbmRsZXIgPSBzY29wZS5fYXBwbHlGaWx0ZXJzKGhhbmRsZXIsIG51bGwsIHRoaXMuZmlsdGVycyk7XG4gICAgfVxuICAgIHRoaXMudXBkYXRlKGhhbmRsZXIpO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG59O1xuXG4vKipcbiAqIFNldCB0aGUgY29ycmVzcG9uZGluZyB2YWx1ZSB3aXRoIHRoZSBzZXR0ZXIuXG4gKiBUaGlzIHNob3VsZCBvbmx5IGJlIHVzZWQgaW4gdHdvLXdheSBkaXJlY3RpdmVzXG4gKiBlLmcuIHYtbW9kZWwuXG4gKlxuICogQHBhcmFtIHsqfSB2YWx1ZVxuICogQHB1YmxpY1xuICovXG5cbkRpcmVjdGl2ZS5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBlbHNlICovXG4gIGlmICh0aGlzLnR3b1dheSkge1xuICAgIHRoaXMuX3dpdGhMb2NrKGZ1bmN0aW9uICgpIHtcbiAgICAgIHRoaXMuX3dhdGNoZXIuc2V0KHZhbHVlKTtcbiAgICB9KTtcbiAgfSBlbHNlIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgd2FybignRGlyZWN0aXZlLnNldCgpIGNhbiBvbmx5IGJlIHVzZWQgaW5zaWRlIHR3b1dheScgKyAnZGlyZWN0aXZlcy4nKTtcbiAgfVxufTtcblxuLyoqXG4gKiBFeGVjdXRlIGEgZnVuY3Rpb24gd2hpbGUgcHJldmVudGluZyB0aGF0IGZ1bmN0aW9uIGZyb21cbiAqIHRyaWdnZXJpbmcgdXBkYXRlcyBvbiB0aGlzIGRpcmVjdGl2ZSBpbnN0YW5jZS5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxuICovXG5cbkRpcmVjdGl2ZS5wcm90b3R5cGUuX3dpdGhMb2NrID0gZnVuY3Rpb24gKGZuKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgc2VsZi5fbG9ja2VkID0gdHJ1ZTtcbiAgZm4uY2FsbChzZWxmKTtcbiAgbmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgIHNlbGYuX2xvY2tlZCA9IGZhbHNlO1xuICB9KTtcbn07XG5cbi8qKlxuICogQ29udmVuaWVuY2UgbWV0aG9kIHRoYXQgYXR0YWNoZXMgYSBET00gZXZlbnQgbGlzdGVuZXJcbiAqIHRvIHRoZSBkaXJlY3RpdmUgZWxlbWVudCBhbmQgYXV0b21ldGljYWxseSB0ZWFycyBpdCBkb3duXG4gKiBkdXJpbmcgdW5iaW5kLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxuICogQHBhcmFtIHtGdW5jdGlvbn0gaGFuZGxlclxuICovXG5cbkRpcmVjdGl2ZS5wcm90b3R5cGUub24gPSBmdW5jdGlvbiAoZXZlbnQsIGhhbmRsZXIpIHtcbiAgb24kMSh0aGlzLmVsLCBldmVudCwgaGFuZGxlcik7KHRoaXMuX2xpc3RlbmVycyB8fCAodGhpcy5fbGlzdGVuZXJzID0gW10pKS5wdXNoKFtldmVudCwgaGFuZGxlcl0pO1xufTtcblxuLyoqXG4gKiBUZWFyZG93biB0aGUgd2F0Y2hlciBhbmQgY2FsbCB1bmJpbmQuXG4gKi9cblxuRGlyZWN0aXZlLnByb3RvdHlwZS5fdGVhcmRvd24gPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0aGlzLl9ib3VuZCkge1xuICAgIHRoaXMuX2JvdW5kID0gZmFsc2U7XG4gICAgaWYgKHRoaXMudW5iaW5kKSB7XG4gICAgICB0aGlzLnVuYmluZCgpO1xuICAgIH1cbiAgICBpZiAodGhpcy5fd2F0Y2hlcikge1xuICAgICAgdGhpcy5fd2F0Y2hlci50ZWFyZG93bigpO1xuICAgIH1cbiAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xuICAgIHZhciBpO1xuICAgIGlmIChsaXN0ZW5lcnMpIHtcbiAgICAgIGkgPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICBvZmYodGhpcy5lbCwgbGlzdGVuZXJzW2ldWzBdLCBsaXN0ZW5lcnNbaV1bMV0pO1xuICAgICAgfVxuICAgIH1cbiAgICB2YXIgdW53YXRjaEZucyA9IHRoaXMuX3BhcmFtVW53YXRjaEZucztcbiAgICBpZiAodW53YXRjaEZucykge1xuICAgICAgaSA9IHVud2F0Y2hGbnMubGVuZ3RoO1xuICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICB1bndhdGNoRm5zW2ldKCk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHRoaXMuZWwpIHtcbiAgICAgIHRoaXMuZWwuX3Z1ZV9kaXJlY3RpdmVzLiRyZW1vdmUodGhpcyk7XG4gICAgfVxuICAgIHRoaXMudm0gPSB0aGlzLmVsID0gdGhpcy5fd2F0Y2hlciA9IHRoaXMuX2xpc3RlbmVycyA9IG51bGw7XG4gIH1cbn07XG5cbmZ1bmN0aW9uIGxpZmVjeWNsZU1peGluIChWdWUpIHtcblxuICAvKipcbiAgICogVXBkYXRlIHYtcmVmIGZvciBjb21wb25lbnQuXG4gICAqXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gcmVtb3ZlXG4gICAqL1xuXG4gIFZ1ZS5wcm90b3R5cGUuX3VwZGF0ZVJlZiA9IGZ1bmN0aW9uIChyZW1vdmUpIHtcbiAgICB2YXIgcmVmID0gdGhpcy4kb3B0aW9ucy5fcmVmO1xuICAgIGlmIChyZWYpIHtcbiAgICAgIHZhciByZWZzID0gKHRoaXMuX3Njb3BlIHx8IHRoaXMuX2NvbnRleHQpLiRyZWZzO1xuICAgICAgaWYgKHJlbW92ZSkge1xuICAgICAgICBpZiAocmVmc1tyZWZdID09PSB0aGlzKSB7XG4gICAgICAgICAgcmVmc1tyZWZdID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVmc1tyZWZdID0gdGhpcztcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIFRyYW5zY2x1ZGUsIGNvbXBpbGUgYW5kIGxpbmsgZWxlbWVudC5cbiAgICpcbiAgICogSWYgYSBwcmUtY29tcGlsZWQgbGlua2VyIGlzIGF2YWlsYWJsZSwgdGhhdCBtZWFucyB0aGVcbiAgICogcGFzc2VkIGluIGVsZW1lbnQgd2lsbCBiZSBwcmUtdHJhbnNjbHVkZWQgYW5kIGNvbXBpbGVkXG4gICAqIGFzIHdlbGwgLSBhbGwgd2UgbmVlZCB0byBkbyBpcyB0byBjYWxsIHRoZSBsaW5rZXIuXG4gICAqXG4gICAqIE90aGVyd2lzZSB3ZSBuZWVkIHRvIGNhbGwgdHJhbnNjbHVkZS9jb21waWxlL2xpbmsgaGVyZS5cbiAgICpcbiAgICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICAgKiBAcmV0dXJuIHtFbGVtZW50fVxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLl9jb21waWxlID0gZnVuY3Rpb24gKGVsKSB7XG4gICAgdmFyIG9wdGlvbnMgPSB0aGlzLiRvcHRpb25zO1xuXG4gICAgLy8gdHJhbnNjbHVkZSBhbmQgaW5pdCBlbGVtZW50XG4gICAgLy8gdHJhbnNjbHVkZSBjYW4gcG90ZW50aWFsbHkgcmVwbGFjZSBvcmlnaW5hbFxuICAgIC8vIHNvIHdlIG5lZWQgdG8ga2VlcCByZWZlcmVuY2U7IHRoaXMgc3RlcCBhbHNvIGluamVjdHNcbiAgICAvLyB0aGUgdGVtcGxhdGUgYW5kIGNhY2hlcyB0aGUgb3JpZ2luYWwgYXR0cmlidXRlc1xuICAgIC8vIG9uIHRoZSBjb250YWluZXIgbm9kZSBhbmQgcmVwbGFjZXIgbm9kZS5cbiAgICB2YXIgb3JpZ2luYWwgPSBlbDtcbiAgICBlbCA9IHRyYW5zY2x1ZGUoZWwsIG9wdGlvbnMpO1xuICAgIHRoaXMuX2luaXRFbGVtZW50KGVsKTtcblxuICAgIC8vIGhhbmRsZSB2LXByZSBvbiByb290IG5vZGUgKCMyMDI2KVxuICAgIGlmIChlbC5ub2RlVHlwZSA9PT0gMSAmJiBnZXRBdHRyKGVsLCAndi1wcmUnKSAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIHJvb3QgaXMgYWx3YXlzIGNvbXBpbGVkIHBlci1pbnN0YW5jZSwgYmVjYXVzZVxuICAgIC8vIGNvbnRhaW5lciBhdHRycyBhbmQgcHJvcHMgY2FuIGJlIGRpZmZlcmVudCBldmVyeSB0aW1lLlxuICAgIHZhciBjb250ZXh0T3B0aW9ucyA9IHRoaXMuX2NvbnRleHQgJiYgdGhpcy5fY29udGV4dC4kb3B0aW9ucztcbiAgICB2YXIgcm9vdExpbmtlciA9IGNvbXBpbGVSb290KGVsLCBvcHRpb25zLCBjb250ZXh0T3B0aW9ucyk7XG5cbiAgICAvLyBjb21waWxlIGFuZCBsaW5rIHRoZSByZXN0XG4gICAgdmFyIGNvbnRlbnRMaW5rRm47XG4gICAgdmFyIGN0b3IgPSB0aGlzLmNvbnN0cnVjdG9yO1xuICAgIC8vIGNvbXBvbmVudCBjb21waWxhdGlvbiBjYW4gYmUgY2FjaGVkXG4gICAgLy8gYXMgbG9uZyBhcyBpdCdzIG5vdCB1c2luZyBpbmxpbmUtdGVtcGxhdGVcbiAgICBpZiAob3B0aW9ucy5fbGlua2VyQ2FjaGFibGUpIHtcbiAgICAgIGNvbnRlbnRMaW5rRm4gPSBjdG9yLmxpbmtlcjtcbiAgICAgIGlmICghY29udGVudExpbmtGbikge1xuICAgICAgICBjb250ZW50TGlua0ZuID0gY3Rvci5saW5rZXIgPSBjb21waWxlKGVsLCBvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBsaW5rIHBoYXNlXG4gICAgLy8gbWFrZSBzdXJlIHRvIGxpbmsgcm9vdCB3aXRoIHByb3Agc2NvcGUhXG4gICAgdmFyIHJvb3RVbmxpbmtGbiA9IHJvb3RMaW5rZXIodGhpcywgZWwsIHRoaXMuX3Njb3BlKTtcbiAgICB2YXIgY29udGVudFVubGlua0ZuID0gY29udGVudExpbmtGbiA/IGNvbnRlbnRMaW5rRm4odGhpcywgZWwpIDogY29tcGlsZShlbCwgb3B0aW9ucykodGhpcywgZWwpO1xuXG4gICAgLy8gcmVnaXN0ZXIgY29tcG9zaXRlIHVubGluayBmdW5jdGlvblxuICAgIC8vIHRvIGJlIGNhbGxlZCBkdXJpbmcgaW5zdGFuY2UgZGVzdHJ1Y3Rpb25cbiAgICB0aGlzLl91bmxpbmtGbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJvb3RVbmxpbmtGbigpO1xuICAgICAgLy8gcGFzc2luZyBkZXN0cm95aW5nOiB0cnVlIHRvIGF2b2lkIHNlYXJjaGluZyBhbmRcbiAgICAgIC8vIHNwbGljaW5nIHRoZSBkaXJlY3RpdmVzXG4gICAgICBjb250ZW50VW5saW5rRm4odHJ1ZSk7XG4gICAgfTtcblxuICAgIC8vIGZpbmFsbHkgcmVwbGFjZSBvcmlnaW5hbFxuICAgIGlmIChvcHRpb25zLnJlcGxhY2UpIHtcbiAgICAgIHJlcGxhY2Uob3JpZ2luYWwsIGVsKTtcbiAgICB9XG5cbiAgICB0aGlzLl9pc0NvbXBpbGVkID0gdHJ1ZTtcbiAgICB0aGlzLl9jYWxsSG9vaygnY29tcGlsZWQnKTtcbiAgICByZXR1cm4gZWw7XG4gIH07XG5cbiAgLyoqXG4gICAqIEluaXRpYWxpemUgaW5zdGFuY2UgZWxlbWVudC4gQ2FsbGVkIGluIHRoZSBwdWJsaWNcbiAgICogJG1vdW50KCkgbWV0aG9kLlxuICAgKlxuICAgKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gICAqL1xuXG4gIFZ1ZS5wcm90b3R5cGUuX2luaXRFbGVtZW50ID0gZnVuY3Rpb24gKGVsKSB7XG4gICAgaWYgKGVsIGluc3RhbmNlb2YgRG9jdW1lbnRGcmFnbWVudCkge1xuICAgICAgdGhpcy5faXNGcmFnbWVudCA9IHRydWU7XG4gICAgICB0aGlzLiRlbCA9IHRoaXMuX2ZyYWdtZW50U3RhcnQgPSBlbC5maXJzdENoaWxkO1xuICAgICAgdGhpcy5fZnJhZ21lbnRFbmQgPSBlbC5sYXN0Q2hpbGQ7XG4gICAgICAvLyBzZXQgcGVyc2lzdGVkIHRleHQgYW5jaG9ycyB0byBlbXB0eVxuICAgICAgaWYgKHRoaXMuX2ZyYWdtZW50U3RhcnQubm9kZVR5cGUgPT09IDMpIHtcbiAgICAgICAgdGhpcy5fZnJhZ21lbnRTdGFydC5kYXRhID0gdGhpcy5fZnJhZ21lbnRFbmQuZGF0YSA9ICcnO1xuICAgICAgfVxuICAgICAgdGhpcy5fZnJhZ21lbnQgPSBlbDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy4kZWwgPSBlbDtcbiAgICB9XG4gICAgdGhpcy4kZWwuX192dWVfXyA9IHRoaXM7XG4gICAgdGhpcy5fY2FsbEhvb2soJ2JlZm9yZUNvbXBpbGUnKTtcbiAgfTtcblxuICAvKipcbiAgICogQ3JlYXRlIGFuZCBiaW5kIGEgZGlyZWN0aXZlIHRvIGFuIGVsZW1lbnQuXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIC0gZGlyZWN0aXZlIG5hbWVcbiAgICogQHBhcmFtIHtOb2RlfSBub2RlICAgLSB0YXJnZXQgbm9kZVxuICAgKiBAcGFyYW0ge09iamVjdH0gZGVzYyAtIHBhcnNlZCBkaXJlY3RpdmUgZGVzY3JpcHRvclxuICAgKiBAcGFyYW0ge09iamVjdH0gZGVmICAtIGRpcmVjdGl2ZSBkZWZpbml0aW9uIG9iamVjdFxuICAgKiBAcGFyYW0ge1Z1ZX0gW2hvc3RdIC0gdHJhbnNjbHVzaW9uIGhvc3QgY29tcG9uZW50XG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbc2NvcGVdIC0gdi1mb3Igc2NvcGVcbiAgICogQHBhcmFtIHtGcmFnbWVudH0gW2ZyYWddIC0gb3duZXIgZnJhZ21lbnRcbiAgICovXG5cbiAgVnVlLnByb3RvdHlwZS5fYmluZERpciA9IGZ1bmN0aW9uIChkZXNjcmlwdG9yLCBub2RlLCBob3N0LCBzY29wZSwgZnJhZykge1xuICAgIHRoaXMuX2RpcmVjdGl2ZXMucHVzaChuZXcgRGlyZWN0aXZlKGRlc2NyaXB0b3IsIHRoaXMsIG5vZGUsIGhvc3QsIHNjb3BlLCBmcmFnKSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFRlYXJkb3duIGFuIGluc3RhbmNlLCB1bm9ic2VydmVzIHRoZSBkYXRhLCB1bmJpbmQgYWxsIHRoZVxuICAgKiBkaXJlY3RpdmVzLCB0dXJuIG9mZiBhbGwgdGhlIGV2ZW50IGxpc3RlbmVycywgZXRjLlxuICAgKlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IHJlbW92ZSAtIHdoZXRoZXIgdG8gcmVtb3ZlIHRoZSBET00gbm9kZS5cbiAgICogQHBhcmFtIHtCb29sZWFufSBkZWZlckNsZWFudXAgLSBpZiB0cnVlLCBkZWZlciBjbGVhbnVwIHRvXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYmUgY2FsbGVkIGxhdGVyXG4gICAqL1xuXG4gIFZ1ZS5wcm90b3R5cGUuX2Rlc3Ryb3kgPSBmdW5jdGlvbiAocmVtb3ZlLCBkZWZlckNsZWFudXApIHtcbiAgICBpZiAodGhpcy5faXNCZWluZ0Rlc3Ryb3llZCkge1xuICAgICAgaWYgKCFkZWZlckNsZWFudXApIHtcbiAgICAgICAgdGhpcy5fY2xlYW51cCgpO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBkZXN0cm95UmVhZHk7XG4gICAgdmFyIHBlbmRpbmdSZW1vdmFsO1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIC8vIENsZWFudXAgc2hvdWxkIGJlIGNhbGxlZCBlaXRoZXIgc3luY2hyb25vdXNseSBvciBhc3luY2hyb25veXNseSBhc1xuICAgIC8vIGNhbGxiYWNrIG9mIHRoaXMuJHJlbW92ZSgpLCBvciBpZiByZW1vdmUgYW5kIGRlZmVyQ2xlYW51cCBhcmUgZmFsc2UuXG4gICAgLy8gSW4gYW55IGNhc2UgaXQgc2hvdWxkIGJlIGNhbGxlZCBhZnRlciBhbGwgb3RoZXIgcmVtb3ZpbmcsIHVuYmluZGluZyBhbmRcbiAgICAvLyB0dXJuaW5nIG9mIGlzIGRvbmVcbiAgICB2YXIgY2xlYW51cElmUG9zc2libGUgPSBmdW5jdGlvbiBjbGVhbnVwSWZQb3NzaWJsZSgpIHtcbiAgICAgIGlmIChkZXN0cm95UmVhZHkgJiYgIXBlbmRpbmdSZW1vdmFsICYmICFkZWZlckNsZWFudXApIHtcbiAgICAgICAgc2VsZi5fY2xlYW51cCgpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICAvLyByZW1vdmUgRE9NIGVsZW1lbnRcbiAgICBpZiAocmVtb3ZlICYmIHRoaXMuJGVsKSB7XG4gICAgICBwZW5kaW5nUmVtb3ZhbCA9IHRydWU7XG4gICAgICB0aGlzLiRyZW1vdmUoZnVuY3Rpb24gKCkge1xuICAgICAgICBwZW5kaW5nUmVtb3ZhbCA9IGZhbHNlO1xuICAgICAgICBjbGVhbnVwSWZQb3NzaWJsZSgpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdGhpcy5fY2FsbEhvb2soJ2JlZm9yZURlc3Ryb3knKTtcbiAgICB0aGlzLl9pc0JlaW5nRGVzdHJveWVkID0gdHJ1ZTtcbiAgICB2YXIgaTtcbiAgICAvLyByZW1vdmUgc2VsZiBmcm9tIHBhcmVudC4gb25seSBuZWNlc3NhcnlcbiAgICAvLyBpZiBwYXJlbnQgaXMgbm90IGJlaW5nIGRlc3Ryb3llZCBhcyB3ZWxsLlxuICAgIHZhciBwYXJlbnQgPSB0aGlzLiRwYXJlbnQ7XG4gICAgaWYgKHBhcmVudCAmJiAhcGFyZW50Ll9pc0JlaW5nRGVzdHJveWVkKSB7XG4gICAgICBwYXJlbnQuJGNoaWxkcmVuLiRyZW1vdmUodGhpcyk7XG4gICAgICAvLyB1bnJlZ2lzdGVyIHJlZiAocmVtb3ZlOiB0cnVlKVxuICAgICAgdGhpcy5fdXBkYXRlUmVmKHRydWUpO1xuICAgIH1cbiAgICAvLyBkZXN0cm95IGFsbCBjaGlsZHJlbi5cbiAgICBpID0gdGhpcy4kY2hpbGRyZW4ubGVuZ3RoO1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIHRoaXMuJGNoaWxkcmVuW2ldLiRkZXN0cm95KCk7XG4gICAgfVxuICAgIC8vIHRlYXJkb3duIHByb3BzXG4gICAgaWYgKHRoaXMuX3Byb3BzVW5saW5rRm4pIHtcbiAgICAgIHRoaXMuX3Byb3BzVW5saW5rRm4oKTtcbiAgICB9XG4gICAgLy8gdGVhcmRvd24gYWxsIGRpcmVjdGl2ZXMuIHRoaXMgYWxzbyB0ZWFyc2Rvd24gYWxsXG4gICAgLy8gZGlyZWN0aXZlLW93bmVkIHdhdGNoZXJzLlxuICAgIGlmICh0aGlzLl91bmxpbmtGbikge1xuICAgICAgdGhpcy5fdW5saW5rRm4oKTtcbiAgICB9XG4gICAgaSA9IHRoaXMuX3dhdGNoZXJzLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICB0aGlzLl93YXRjaGVyc1tpXS50ZWFyZG93bigpO1xuICAgIH1cbiAgICAvLyByZW1vdmUgcmVmZXJlbmNlIHRvIHNlbGYgb24gJGVsXG4gICAgaWYgKHRoaXMuJGVsKSB7XG4gICAgICB0aGlzLiRlbC5fX3Z1ZV9fID0gbnVsbDtcbiAgICB9XG5cbiAgICBkZXN0cm95UmVhZHkgPSB0cnVlO1xuICAgIGNsZWFudXBJZlBvc3NpYmxlKCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIENsZWFuIHVwIHRvIGVuc3VyZSBnYXJiYWdlIGNvbGxlY3Rpb24uXG4gICAqIFRoaXMgaXMgY2FsbGVkIGFmdGVyIHRoZSBsZWF2ZSB0cmFuc2l0aW9uIGlmIHRoZXJlXG4gICAqIGlzIGFueS5cbiAgICovXG5cbiAgVnVlLnByb3RvdHlwZS5fY2xlYW51cCA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5faXNEZXN0cm95ZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gcmVtb3ZlIHNlbGYgZnJvbSBvd25lciBmcmFnbWVudFxuICAgIC8vIGRvIGl0IGluIGNsZWFudXAgc28gdGhhdCB3ZSBjYW4gY2FsbCAkZGVzdHJveSB3aXRoXG4gICAgLy8gZGVmZXIgcmlnaHQgd2hlbiBhIGZyYWdtZW50IGlzIGFib3V0IHRvIGJlIHJlbW92ZWQuXG4gICAgaWYgKHRoaXMuX2ZyYWcpIHtcbiAgICAgIHRoaXMuX2ZyYWcuY2hpbGRyZW4uJHJlbW92ZSh0aGlzKTtcbiAgICB9XG4gICAgLy8gcmVtb3ZlIHJlZmVyZW5jZSBmcm9tIGRhdGEgb2JcbiAgICAvLyBmcm96ZW4gb2JqZWN0IG1heSBub3QgaGF2ZSBvYnNlcnZlci5cbiAgICBpZiAodGhpcy5fZGF0YS5fX29iX18pIHtcbiAgICAgIHRoaXMuX2RhdGEuX19vYl9fLnJlbW92ZVZtKHRoaXMpO1xuICAgIH1cbiAgICAvLyBDbGVhbiB1cCByZWZlcmVuY2VzIHRvIHByaXZhdGUgcHJvcGVydGllcyBhbmQgb3RoZXJcbiAgICAvLyBpbnN0YW5jZXMuIHByZXNlcnZlIHJlZmVyZW5jZSB0byBfZGF0YSBzbyB0aGF0IHByb3h5XG4gICAgLy8gYWNjZXNzb3JzIHN0aWxsIHdvcmsuIFRoZSBvbmx5IHBvdGVudGlhbCBzaWRlIGVmZmVjdFxuICAgIC8vIGhlcmUgaXMgdGhhdCBtdXRhdGluZyB0aGUgaW5zdGFuY2UgYWZ0ZXIgaXQncyBkZXN0cm95ZWRcbiAgICAvLyBtYXkgYWZmZWN0IHRoZSBzdGF0ZSBvZiBvdGhlciBjb21wb25lbnRzIHRoYXQgYXJlIHN0aWxsXG4gICAgLy8gb2JzZXJ2aW5nIHRoZSBzYW1lIG9iamVjdCwgYnV0IHRoYXQgc2VlbXMgdG8gYmUgYVxuICAgIC8vIHJlYXNvbmFibGUgcmVzcG9uc2liaWxpdHkgZm9yIHRoZSB1c2VyIHJhdGhlciB0aGFuXG4gICAgLy8gYWx3YXlzIHRocm93aW5nIGFuIGVycm9yIG9uIHRoZW0uXG4gICAgdGhpcy4kZWwgPSB0aGlzLiRwYXJlbnQgPSB0aGlzLiRyb290ID0gdGhpcy4kY2hpbGRyZW4gPSB0aGlzLl93YXRjaGVycyA9IHRoaXMuX2NvbnRleHQgPSB0aGlzLl9zY29wZSA9IHRoaXMuX2RpcmVjdGl2ZXMgPSBudWxsO1xuICAgIC8vIGNhbGwgdGhlIGxhc3QgaG9vay4uLlxuICAgIHRoaXMuX2lzRGVzdHJveWVkID0gdHJ1ZTtcbiAgICB0aGlzLl9jYWxsSG9vaygnZGVzdHJveWVkJyk7XG4gICAgLy8gdHVybiBvZmYgYWxsIGluc3RhbmNlIGxpc3RlbmVycy5cbiAgICB0aGlzLiRvZmYoKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gbWlzY01peGluIChWdWUpIHtcblxuICAvKipcbiAgICogQXBwbHkgYSBsaXN0IG9mIGZpbHRlciAoZGVzY3JpcHRvcnMpIHRvIGEgdmFsdWUuXG4gICAqIFVzaW5nIHBsYWluIGZvciBsb29wcyBoZXJlIGJlY2F1c2UgdGhpcyB3aWxsIGJlIGNhbGxlZCBpblxuICAgKiB0aGUgZ2V0dGVyIG9mIGFueSB3YXRjaGVyIHdpdGggZmlsdGVycyBzbyBpdCBpcyB2ZXJ5XG4gICAqIHBlcmZvcm1hbmNlIHNlbnNpdGl2ZS5cbiAgICpcbiAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgKiBAcGFyYW0geyp9IFtvbGRWYWx1ZV1cbiAgICogQHBhcmFtIHtBcnJheX0gZmlsdGVyc1xuICAgKiBAcGFyYW0ge0Jvb2xlYW59IHdyaXRlXG4gICAqIEByZXR1cm4geyp9XG4gICAqL1xuXG4gIFZ1ZS5wcm90b3R5cGUuX2FwcGx5RmlsdGVycyA9IGZ1bmN0aW9uICh2YWx1ZSwgb2xkVmFsdWUsIGZpbHRlcnMsIHdyaXRlKSB7XG4gICAgdmFyIGZpbHRlciwgZm4sIGFyZ3MsIGFyZywgb2Zmc2V0LCBpLCBsLCBqLCBrO1xuICAgIGZvciAoaSA9IDAsIGwgPSBmaWx0ZXJzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgZmlsdGVyID0gZmlsdGVyc1tpXTtcbiAgICAgIGZuID0gcmVzb2x2ZUFzc2V0KHRoaXMuJG9wdGlvbnMsICdmaWx0ZXJzJywgZmlsdGVyLm5hbWUpO1xuICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgICAgYXNzZXJ0QXNzZXQoZm4sICdmaWx0ZXInLCBmaWx0ZXIubmFtZSk7XG4gICAgICB9XG4gICAgICBpZiAoIWZuKSBjb250aW51ZTtcbiAgICAgIGZuID0gd3JpdGUgPyBmbi53cml0ZSA6IGZuLnJlYWQgfHwgZm47XG4gICAgICBpZiAodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKSBjb250aW51ZTtcbiAgICAgIGFyZ3MgPSB3cml0ZSA/IFt2YWx1ZSwgb2xkVmFsdWVdIDogW3ZhbHVlXTtcbiAgICAgIG9mZnNldCA9IHdyaXRlID8gMiA6IDE7XG4gICAgICBpZiAoZmlsdGVyLmFyZ3MpIHtcbiAgICAgICAgZm9yIChqID0gMCwgayA9IGZpbHRlci5hcmdzLmxlbmd0aDsgaiA8IGs7IGorKykge1xuICAgICAgICAgIGFyZyA9IGZpbHRlci5hcmdzW2pdO1xuICAgICAgICAgIGFyZ3NbaiArIG9mZnNldF0gPSBhcmcuZHluYW1pYyA/IHRoaXMuJGdldChhcmcudmFsdWUpIDogYXJnLnZhbHVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB2YWx1ZSA9IGZuLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWU7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJlc29sdmUgYSBjb21wb25lbnQsIGRlcGVuZGluZyBvbiB3aGV0aGVyIHRoZSBjb21wb25lbnRcbiAgICogaXMgZGVmaW5lZCBub3JtYWxseSBvciB1c2luZyBhbiBhc3luYyBmYWN0b3J5IGZ1bmN0aW9uLlxuICAgKiBSZXNvbHZlcyBzeW5jaHJvbm91c2x5IGlmIGFscmVhZHkgcmVzb2x2ZWQsIG90aGVyd2lzZVxuICAgKiByZXNvbHZlcyBhc3luY2hyb25vdXNseSBhbmQgY2FjaGVzIHRoZSByZXNvbHZlZFxuICAgKiBjb25zdHJ1Y3RvciBvbiB0aGUgZmFjdG9yeS5cbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IGlkXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNiXG4gICAqL1xuXG4gIFZ1ZS5wcm90b3R5cGUuX3Jlc29sdmVDb21wb25lbnQgPSBmdW5jdGlvbiAoaWQsIGNiKSB7XG4gICAgdmFyIGZhY3RvcnkgPSByZXNvbHZlQXNzZXQodGhpcy4kb3B0aW9ucywgJ2NvbXBvbmVudHMnLCBpZCk7XG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgIGFzc2VydEFzc2V0KGZhY3RvcnksICdjb21wb25lbnQnLCBpZCk7XG4gICAgfVxuICAgIGlmICghZmFjdG9yeSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBhc3luYyBjb21wb25lbnQgZmFjdG9yeVxuICAgIGlmICghZmFjdG9yeS5vcHRpb25zKSB7XG4gICAgICBpZiAoZmFjdG9yeS5yZXNvbHZlZCkge1xuICAgICAgICAvLyBjYWNoZWRcbiAgICAgICAgY2IoZmFjdG9yeS5yZXNvbHZlZCk7XG4gICAgICB9IGVsc2UgaWYgKGZhY3RvcnkucmVxdWVzdGVkKSB7XG4gICAgICAgIC8vIHBvb2wgY2FsbGJhY2tzXG4gICAgICAgIGZhY3RvcnkucGVuZGluZ0NhbGxiYWNrcy5wdXNoKGNiKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZhY3RvcnkucmVxdWVzdGVkID0gdHJ1ZTtcbiAgICAgICAgdmFyIGNicyA9IGZhY3RvcnkucGVuZGluZ0NhbGxiYWNrcyA9IFtjYl07XG4gICAgICAgIGZhY3RvcnkoZnVuY3Rpb24gcmVzb2x2ZShyZXMpIHtcbiAgICAgICAgICBpZiAoaXNQbGFpbk9iamVjdChyZXMpKSB7XG4gICAgICAgICAgICByZXMgPSBWdWUuZXh0ZW5kKHJlcyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGNhY2hlIHJlc29sdmVkXG4gICAgICAgICAgZmFjdG9yeS5yZXNvbHZlZCA9IHJlcztcbiAgICAgICAgICAvLyBpbnZva2UgY2FsbGJhY2tzXG4gICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjYnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICBjYnNbaV0ocmVzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIGZ1bmN0aW9uIHJlamVjdChyZWFzb24pIHtcbiAgICAgICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHdhcm4oJ0ZhaWxlZCB0byByZXNvbHZlIGFzeW5jIGNvbXBvbmVudDogJyArIGlkICsgJy4gJyArIChyZWFzb24gPyAnXFxuUmVhc29uOiAnICsgcmVhc29uIDogJycpKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIG5vcm1hbCBjb21wb25lbnRcbiAgICAgIGNiKGZhY3RvcnkpO1xuICAgIH1cbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2xvYmFsQVBJIChWdWUpIHtcblxuICAvKipcbiAgICogRXhwb3NlIHVzZWZ1bCBpbnRlcm5hbHNcbiAgICovXG5cbiAgVnVlLnV0aWwgPSB1dGlsO1xuICBWdWUuY29uZmlnID0gY29uZmlnO1xuICBWdWUuc2V0ID0gc2V0O1xuICBWdWVbJ2RlbGV0ZSddID0gZGVsO1xuICBWdWUubmV4dFRpY2sgPSBuZXh0VGljaztcblxuICAvKipcbiAgICogVGhlIGZvbGxvd2luZyBhcmUgZXhwb3NlZCBmb3IgYWR2YW5jZWQgdXNhZ2UgLyBwbHVnaW5zXG4gICAqL1xuXG4gIFZ1ZS5jb21waWxlciA9IGNvbXBpbGVyO1xuICBWdWUuRnJhZ21lbnRGYWN0b3J5ID0gRnJhZ21lbnRGYWN0b3J5O1xuICBWdWUuaW50ZXJuYWxEaXJlY3RpdmVzID0gaW50ZXJuYWxEaXJlY3RpdmVzO1xuICBWdWUucGFyc2VycyA9IHtcbiAgICBwYXRoOiBwYXRoLFxuICAgIHRleHQ6IHRleHQkMSxcbiAgICB0ZW1wbGF0ZTogdGVtcGxhdGUsXG4gICAgZGlyZWN0aXZlOiBkaXJlY3RpdmUsXG4gICAgZXhwcmVzc2lvbjogZXhwcmVzc2lvblxuICB9O1xuXG4gIC8qKlxuICAgKiBFYWNoIGluc3RhbmNlIGNvbnN0cnVjdG9yLCBpbmNsdWRpbmcgVnVlLCBoYXMgYSB1bmlxdWVcbiAgICogY2lkLiBUaGlzIGVuYWJsZXMgdXMgdG8gY3JlYXRlIHdyYXBwZWQgXCJjaGlsZFxuICAgKiBjb25zdHJ1Y3RvcnNcIiBmb3IgcHJvdG90eXBhbCBpbmhlcml0YW5jZSBhbmQgY2FjaGUgdGhlbS5cbiAgICovXG5cbiAgVnVlLmNpZCA9IDA7XG4gIHZhciBjaWQgPSAxO1xuXG4gIC8qKlxuICAgKiBDbGFzcyBpbmhlcml0YW5jZVxuICAgKlxuICAgKiBAcGFyYW0ge09iamVjdH0gZXh0ZW5kT3B0aW9uc1xuICAgKi9cblxuICBWdWUuZXh0ZW5kID0gZnVuY3Rpb24gKGV4dGVuZE9wdGlvbnMpIHtcbiAgICBleHRlbmRPcHRpb25zID0gZXh0ZW5kT3B0aW9ucyB8fCB7fTtcbiAgICB2YXIgU3VwZXIgPSB0aGlzO1xuICAgIHZhciBpc0ZpcnN0RXh0ZW5kID0gU3VwZXIuY2lkID09PSAwO1xuICAgIGlmIChpc0ZpcnN0RXh0ZW5kICYmIGV4dGVuZE9wdGlvbnMuX0N0b3IpIHtcbiAgICAgIHJldHVybiBleHRlbmRPcHRpb25zLl9DdG9yO1xuICAgIH1cbiAgICB2YXIgbmFtZSA9IGV4dGVuZE9wdGlvbnMubmFtZSB8fCBTdXBlci5vcHRpb25zLm5hbWU7XG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgIGlmICghL15bYS16QS1aXVtcXHctXSskLy50ZXN0KG5hbWUpKSB7XG4gICAgICAgIHdhcm4oJ0ludmFsaWQgY29tcG9uZW50IG5hbWU6ICcgKyBuYW1lKTtcbiAgICAgICAgbmFtZSA9IG51bGw7XG4gICAgICB9XG4gICAgfVxuICAgIHZhciBTdWIgPSBjcmVhdGVDbGFzcyhuYW1lIHx8ICdWdWVDb21wb25lbnQnKTtcbiAgICBTdWIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShTdXBlci5wcm90b3R5cGUpO1xuICAgIFN1Yi5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBTdWI7XG4gICAgU3ViLmNpZCA9IGNpZCsrO1xuICAgIFN1Yi5vcHRpb25zID0gbWVyZ2VPcHRpb25zKFN1cGVyLm9wdGlvbnMsIGV4dGVuZE9wdGlvbnMpO1xuICAgIFN1Ylsnc3VwZXInXSA9IFN1cGVyO1xuICAgIC8vIGFsbG93IGZ1cnRoZXIgZXh0ZW5zaW9uXG4gICAgU3ViLmV4dGVuZCA9IFN1cGVyLmV4dGVuZDtcbiAgICAvLyBjcmVhdGUgYXNzZXQgcmVnaXN0ZXJzLCBzbyBleHRlbmRlZCBjbGFzc2VzXG4gICAgLy8gY2FuIGhhdmUgdGhlaXIgcHJpdmF0ZSBhc3NldHMgdG9vLlxuICAgIGNvbmZpZy5fYXNzZXRUeXBlcy5mb3JFYWNoKGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgICBTdWJbdHlwZV0gPSBTdXBlclt0eXBlXTtcbiAgICB9KTtcbiAgICAvLyBlbmFibGUgcmVjdXJzaXZlIHNlbGYtbG9va3VwXG4gICAgaWYgKG5hbWUpIHtcbiAgICAgIFN1Yi5vcHRpb25zLmNvbXBvbmVudHNbbmFtZV0gPSBTdWI7XG4gICAgfVxuICAgIC8vIGNhY2hlIGNvbnN0cnVjdG9yXG4gICAgaWYgKGlzRmlyc3RFeHRlbmQpIHtcbiAgICAgIGV4dGVuZE9wdGlvbnMuX0N0b3IgPSBTdWI7XG4gICAgfVxuICAgIHJldHVybiBTdWI7XG4gIH07XG5cbiAgLyoqXG4gICAqIEEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgc3ViLWNsYXNzIGNvbnN0cnVjdG9yIHdpdGggdGhlXG4gICAqIGdpdmVuIG5hbWUuIFRoaXMgZ2l2ZXMgdXMgbXVjaCBuaWNlciBvdXRwdXQgd2hlblxuICAgKiBsb2dnaW5nIGluc3RhbmNlcyBpbiB0aGUgY29uc29sZS5cbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAgICogQHJldHVybiB7RnVuY3Rpb259XG4gICAqL1xuXG4gIGZ1bmN0aW9uIGNyZWF0ZUNsYXNzKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IEZ1bmN0aW9uKCdyZXR1cm4gZnVuY3Rpb24gJyArIGNsYXNzaWZ5KG5hbWUpICsgJyAob3B0aW9ucykgeyB0aGlzLl9pbml0KG9wdGlvbnMpIH0nKSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIFBsdWdpbiBzeXN0ZW1cbiAgICpcbiAgICogQHBhcmFtIHtPYmplY3R9IHBsdWdpblxuICAgKi9cblxuICBWdWUudXNlID0gZnVuY3Rpb24gKHBsdWdpbikge1xuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgIGlmIChwbHVnaW4uaW5zdGFsbGVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIGFkZGl0aW9uYWwgcGFyYW1ldGVyc1xuICAgIHZhciBhcmdzID0gdG9BcnJheShhcmd1bWVudHMsIDEpO1xuICAgIGFyZ3MudW5zaGlmdCh0aGlzKTtcbiAgICBpZiAodHlwZW9mIHBsdWdpbi5pbnN0YWxsID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBwbHVnaW4uaW5zdGFsbC5hcHBseShwbHVnaW4sIGFyZ3MpO1xuICAgIH0gZWxzZSB7XG4gICAgICBwbHVnaW4uYXBwbHkobnVsbCwgYXJncyk7XG4gICAgfVxuICAgIHBsdWdpbi5pbnN0YWxsZWQgPSB0cnVlO1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBBcHBseSBhIGdsb2JhbCBtaXhpbiBieSBtZXJnaW5nIGl0IGludG8gdGhlIGRlZmF1bHRcbiAgICogb3B0aW9ucy5cbiAgICovXG5cbiAgVnVlLm1peGluID0gZnVuY3Rpb24gKG1peGluKSB7XG4gICAgVnVlLm9wdGlvbnMgPSBtZXJnZU9wdGlvbnMoVnVlLm9wdGlvbnMsIG1peGluKTtcbiAgfTtcblxuICAvKipcbiAgICogQ3JlYXRlIGFzc2V0IHJlZ2lzdHJhdGlvbiBtZXRob2RzIHdpdGggdGhlIGZvbGxvd2luZ1xuICAgKiBzaWduYXR1cmU6XG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBpZFxuICAgKiBAcGFyYW0geyp9IGRlZmluaXRpb25cbiAgICovXG5cbiAgY29uZmlnLl9hc3NldFR5cGVzLmZvckVhY2goZnVuY3Rpb24gKHR5cGUpIHtcbiAgICBWdWVbdHlwZV0gPSBmdW5jdGlvbiAoaWQsIGRlZmluaXRpb24pIHtcbiAgICAgIGlmICghZGVmaW5pdGlvbikge1xuICAgICAgICByZXR1cm4gdGhpcy5vcHRpb25zW3R5cGUgKyAncyddW2lkXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICAgIGlmICh0eXBlID09PSAnY29tcG9uZW50JyAmJiAoY29tbW9uVGFnUkUudGVzdChpZCkgfHwgcmVzZXJ2ZWRUYWdSRS50ZXN0KGlkKSkpIHtcbiAgICAgICAgICAgIHdhcm4oJ0RvIG5vdCB1c2UgYnVpbHQtaW4gb3IgcmVzZXJ2ZWQgSFRNTCBlbGVtZW50cyBhcyBjb21wb25lbnQgJyArICdpZDogJyArIGlkKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGUgPT09ICdjb21wb25lbnQnICYmIGlzUGxhaW5PYmplY3QoZGVmaW5pdGlvbikpIHtcbiAgICAgICAgICBkZWZpbml0aW9uLm5hbWUgPSBpZDtcbiAgICAgICAgICBkZWZpbml0aW9uID0gVnVlLmV4dGVuZChkZWZpbml0aW9uKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLm9wdGlvbnNbdHlwZSArICdzJ11baWRdID0gZGVmaW5pdGlvbjtcbiAgICAgICAgcmV0dXJuIGRlZmluaXRpb247XG4gICAgICB9XG4gICAgfTtcbiAgfSk7XG59XG5cbnZhciBmaWx0ZXJSRSA9IC9bXnxdXFx8W158XS87XG5cbmZ1bmN0aW9uIGRhdGFBUEkgKFZ1ZSkge1xuXG4gIC8qKlxuICAgKiBHZXQgdGhlIHZhbHVlIGZyb20gYW4gZXhwcmVzc2lvbiBvbiB0aGlzIHZtLlxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gZXhwXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gW2FzU3RhdGVtZW50XVxuICAgKiBAcmV0dXJuIHsqfVxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLiRnZXQgPSBmdW5jdGlvbiAoZXhwLCBhc1N0YXRlbWVudCkge1xuICAgIHZhciByZXMgPSBwYXJzZUV4cHJlc3Npb24oZXhwKTtcbiAgICBpZiAocmVzKSB7XG4gICAgICBpZiAoYXNTdGF0ZW1lbnQgJiYgIWlzU2ltcGxlUGF0aChleHApKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIHN0YXRlbWVudEhhbmRsZXIoKSB7XG4gICAgICAgICAgc2VsZi4kYXJndW1lbnRzID0gdG9BcnJheShhcmd1bWVudHMpO1xuICAgICAgICAgIHJlcy5nZXQuY2FsbChzZWxmLCBzZWxmKTtcbiAgICAgICAgICBzZWxmLiRhcmd1bWVudHMgPSBudWxsO1xuICAgICAgICB9O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICByZXR1cm4gcmVzLmdldC5jYWxsKHRoaXMsIHRoaXMpO1xuICAgICAgICB9IGNhdGNoIChlKSB7fVxuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogU2V0IHRoZSB2YWx1ZSBmcm9tIGFuIGV4cHJlc3Npb24gb24gdGhpcyB2bS5cbiAgICogVGhlIGV4cHJlc3Npb24gbXVzdCBiZSBhIHZhbGlkIGxlZnQtaGFuZFxuICAgKiBleHByZXNzaW9uIGluIGFuIGFzc2lnbm1lbnQuXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBleHBcbiAgICogQHBhcmFtIHsqfSB2YWxcbiAgICovXG5cbiAgVnVlLnByb3RvdHlwZS4kc2V0ID0gZnVuY3Rpb24gKGV4cCwgdmFsKSB7XG4gICAgdmFyIHJlcyA9IHBhcnNlRXhwcmVzc2lvbihleHAsIHRydWUpO1xuICAgIGlmIChyZXMgJiYgcmVzLnNldCkge1xuICAgICAgcmVzLnNldC5jYWxsKHRoaXMsIHRoaXMsIHZhbCk7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBEZWxldGUgYSBwcm9wZXJ0eSBvbiB0aGUgVk1cbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLiRkZWxldGUgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgZGVsKHRoaXMuX2RhdGEsIGtleSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFdhdGNoIGFuIGV4cHJlc3Npb24sIHRyaWdnZXIgY2FsbGJhY2sgd2hlbiBpdHNcbiAgICogdmFsdWUgY2hhbmdlcy5cbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd8RnVuY3Rpb259IGV4cE9yRm5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2JcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICAgKiAgICAgICAgICAgICAgICAgLSB7Qm9vbGVhbn0gZGVlcFxuICAgKiAgICAgICAgICAgICAgICAgLSB7Qm9vbGVhbn0gaW1tZWRpYXRlXG4gICAqIEByZXR1cm4ge0Z1bmN0aW9ufSAtIHVud2F0Y2hGblxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLiR3YXRjaCA9IGZ1bmN0aW9uIChleHBPckZuLCBjYiwgb3B0aW9ucykge1xuICAgIHZhciB2bSA9IHRoaXM7XG4gICAgdmFyIHBhcnNlZDtcbiAgICBpZiAodHlwZW9mIGV4cE9yRm4gPT09ICdzdHJpbmcnKSB7XG4gICAgICBwYXJzZWQgPSBwYXJzZURpcmVjdGl2ZShleHBPckZuKTtcbiAgICAgIGV4cE9yRm4gPSBwYXJzZWQuZXhwcmVzc2lvbjtcbiAgICB9XG4gICAgdmFyIHdhdGNoZXIgPSBuZXcgV2F0Y2hlcih2bSwgZXhwT3JGbiwgY2IsIHtcbiAgICAgIGRlZXA6IG9wdGlvbnMgJiYgb3B0aW9ucy5kZWVwLFxuICAgICAgc3luYzogb3B0aW9ucyAmJiBvcHRpb25zLnN5bmMsXG4gICAgICBmaWx0ZXJzOiBwYXJzZWQgJiYgcGFyc2VkLmZpbHRlcnMsXG4gICAgICB1c2VyOiAhb3B0aW9ucyB8fCBvcHRpb25zLnVzZXIgIT09IGZhbHNlXG4gICAgfSk7XG4gICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5pbW1lZGlhdGUpIHtcbiAgICAgIGNiLmNhbGwodm0sIHdhdGNoZXIudmFsdWUpO1xuICAgIH1cbiAgICByZXR1cm4gZnVuY3Rpb24gdW53YXRjaEZuKCkge1xuICAgICAgd2F0Y2hlci50ZWFyZG93bigpO1xuICAgIH07XG4gIH07XG5cbiAgLyoqXG4gICAqIEV2YWx1YXRlIGEgdGV4dCBkaXJlY3RpdmUsIGluY2x1ZGluZyBmaWx0ZXJzLlxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gdGV4dFxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IFthc1N0YXRlbWVudF1cbiAgICogQHJldHVybiB7U3RyaW5nfVxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLiRldmFsID0gZnVuY3Rpb24gKHRleHQsIGFzU3RhdGVtZW50KSB7XG4gICAgLy8gY2hlY2sgZm9yIGZpbHRlcnMuXG4gICAgaWYgKGZpbHRlclJFLnRlc3QodGV4dCkpIHtcbiAgICAgIHZhciBkaXIgPSBwYXJzZURpcmVjdGl2ZSh0ZXh0KTtcbiAgICAgIC8vIHRoZSBmaWx0ZXIgcmVnZXggY2hlY2sgbWlnaHQgZ2l2ZSBmYWxzZSBwb3NpdGl2ZVxuICAgICAgLy8gZm9yIHBpcGVzIGluc2lkZSBzdHJpbmdzLCBzbyBpdCdzIHBvc3NpYmxlIHRoYXRcbiAgICAgIC8vIHdlIGRvbid0IGdldCBhbnkgZmlsdGVycyBoZXJlXG4gICAgICB2YXIgdmFsID0gdGhpcy4kZ2V0KGRpci5leHByZXNzaW9uLCBhc1N0YXRlbWVudCk7XG4gICAgICByZXR1cm4gZGlyLmZpbHRlcnMgPyB0aGlzLl9hcHBseUZpbHRlcnModmFsLCBudWxsLCBkaXIuZmlsdGVycykgOiB2YWw7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIG5vIGZpbHRlclxuICAgICAgcmV0dXJuIHRoaXMuJGdldCh0ZXh0LCBhc1N0YXRlbWVudCk7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBJbnRlcnBvbGF0ZSBhIHBpZWNlIG9mIHRlbXBsYXRlIHRleHQuXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0ZXh0XG4gICAqIEByZXR1cm4ge1N0cmluZ31cbiAgICovXG5cbiAgVnVlLnByb3RvdHlwZS4kaW50ZXJwb2xhdGUgPSBmdW5jdGlvbiAodGV4dCkge1xuICAgIHZhciB0b2tlbnMgPSBwYXJzZVRleHQodGV4dCk7XG4gICAgdmFyIHZtID0gdGhpcztcbiAgICBpZiAodG9rZW5zKSB7XG4gICAgICBpZiAodG9rZW5zLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICByZXR1cm4gdm0uJGV2YWwodG9rZW5zWzBdLnZhbHVlKSArICcnO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRva2Vucy5tYXAoZnVuY3Rpb24gKHRva2VuKSB7XG4gICAgICAgICAgcmV0dXJuIHRva2VuLnRhZyA/IHZtLiRldmFsKHRva2VuLnZhbHVlKSA6IHRva2VuLnZhbHVlO1xuICAgICAgICB9KS5qb2luKCcnKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRleHQ7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBMb2cgaW5zdGFuY2UgZGF0YSBhcyBhIHBsYWluIEpTIG9iamVjdFxuICAgKiBzbyB0aGF0IGl0IGlzIGVhc2llciB0byBpbnNwZWN0IGluIGNvbnNvbGUuXG4gICAqIFRoaXMgbWV0aG9kIGFzc3VtZXMgY29uc29sZSBpcyBhdmFpbGFibGUuXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBbcGF0aF1cbiAgICovXG5cbiAgVnVlLnByb3RvdHlwZS4kbG9nID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgICB2YXIgZGF0YSA9IHBhdGggPyBnZXRQYXRoKHRoaXMuX2RhdGEsIHBhdGgpIDogdGhpcy5fZGF0YTtcbiAgICBpZiAoZGF0YSkge1xuICAgICAgZGF0YSA9IGNsZWFuKGRhdGEpO1xuICAgIH1cbiAgICAvLyBpbmNsdWRlIGNvbXB1dGVkIGZpZWxkc1xuICAgIGlmICghcGF0aCkge1xuICAgICAgZm9yICh2YXIga2V5IGluIHRoaXMuJG9wdGlvbnMuY29tcHV0ZWQpIHtcbiAgICAgICAgZGF0YVtrZXldID0gY2xlYW4odGhpc1trZXldKTtcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc29sZS5sb2coZGF0YSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFwiY2xlYW5cIiBhIGdldHRlci9zZXR0ZXIgY29udmVydGVkIG9iamVjdCBpbnRvIGEgcGxhaW5cbiAgICogb2JqZWN0IGNvcHkuXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSAtIG9ialxuICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAqL1xuXG4gIGZ1bmN0aW9uIGNsZWFuKG9iaikge1xuICAgIHJldHVybiBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KG9iaikpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGRvbUFQSSAoVnVlKSB7XG5cbiAgLyoqXG4gICAqIENvbnZlbmllbmNlIG9uLWluc3RhbmNlIG5leHRUaWNrLiBUaGUgY2FsbGJhY2sgaXNcbiAgICogYXV0by1ib3VuZCB0byB0aGUgaW5zdGFuY2UsIGFuZCB0aGlzIGF2b2lkcyBjb21wb25lbnRcbiAgICogbW9kdWxlcyBoYXZpbmcgdG8gcmVseSBvbiB0aGUgZ2xvYmFsIFZ1ZS5cbiAgICpcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cbiAgICovXG5cbiAgVnVlLnByb3RvdHlwZS4kbmV4dFRpY2sgPSBmdW5jdGlvbiAoZm4pIHtcbiAgICBuZXh0VGljayhmbiwgdGhpcyk7XG4gIH07XG5cbiAgLyoqXG4gICAqIEFwcGVuZCBpbnN0YW5jZSB0byB0YXJnZXRcbiAgICpcbiAgICogQHBhcmFtIHtOb2RlfSB0YXJnZXRcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NiXVxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IFt3aXRoVHJhbnNpdGlvbl0gLSBkZWZhdWx0cyB0byB0cnVlXG4gICAqL1xuXG4gIFZ1ZS5wcm90b3R5cGUuJGFwcGVuZFRvID0gZnVuY3Rpb24gKHRhcmdldCwgY2IsIHdpdGhUcmFuc2l0aW9uKSB7XG4gICAgcmV0dXJuIGluc2VydCh0aGlzLCB0YXJnZXQsIGNiLCB3aXRoVHJhbnNpdGlvbiwgYXBwZW5kLCBhcHBlbmRXaXRoVHJhbnNpdGlvbik7XG4gIH07XG5cbiAgLyoqXG4gICAqIFByZXBlbmQgaW5zdGFuY2UgdG8gdGFyZ2V0XG4gICAqXG4gICAqIEBwYXJhbSB7Tm9kZX0gdGFyZ2V0XG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYl1cbiAgICogQHBhcmFtIHtCb29sZWFufSBbd2l0aFRyYW5zaXRpb25dIC0gZGVmYXVsdHMgdG8gdHJ1ZVxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLiRwcmVwZW5kVG8gPSBmdW5jdGlvbiAodGFyZ2V0LCBjYiwgd2l0aFRyYW5zaXRpb24pIHtcbiAgICB0YXJnZXQgPSBxdWVyeSh0YXJnZXQpO1xuICAgIGlmICh0YXJnZXQuaGFzQ2hpbGROb2RlcygpKSB7XG4gICAgICB0aGlzLiRiZWZvcmUodGFyZ2V0LmZpcnN0Q2hpbGQsIGNiLCB3aXRoVHJhbnNpdGlvbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuJGFwcGVuZFRvKHRhcmdldCwgY2IsIHdpdGhUcmFuc2l0aW9uKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLyoqXG4gICAqIEluc2VydCBpbnN0YW5jZSBiZWZvcmUgdGFyZ2V0XG4gICAqXG4gICAqIEBwYXJhbSB7Tm9kZX0gdGFyZ2V0XG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYl1cbiAgICogQHBhcmFtIHtCb29sZWFufSBbd2l0aFRyYW5zaXRpb25dIC0gZGVmYXVsdHMgdG8gdHJ1ZVxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLiRiZWZvcmUgPSBmdW5jdGlvbiAodGFyZ2V0LCBjYiwgd2l0aFRyYW5zaXRpb24pIHtcbiAgICByZXR1cm4gaW5zZXJ0KHRoaXMsIHRhcmdldCwgY2IsIHdpdGhUcmFuc2l0aW9uLCBiZWZvcmVXaXRoQ2IsIGJlZm9yZVdpdGhUcmFuc2l0aW9uKTtcbiAgfTtcblxuICAvKipcbiAgICogSW5zZXJ0IGluc3RhbmNlIGFmdGVyIHRhcmdldFxuICAgKlxuICAgKiBAcGFyYW0ge05vZGV9IHRhcmdldFxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2JdXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gW3dpdGhUcmFuc2l0aW9uXSAtIGRlZmF1bHRzIHRvIHRydWVcbiAgICovXG5cbiAgVnVlLnByb3RvdHlwZS4kYWZ0ZXIgPSBmdW5jdGlvbiAodGFyZ2V0LCBjYiwgd2l0aFRyYW5zaXRpb24pIHtcbiAgICB0YXJnZXQgPSBxdWVyeSh0YXJnZXQpO1xuICAgIGlmICh0YXJnZXQubmV4dFNpYmxpbmcpIHtcbiAgICAgIHRoaXMuJGJlZm9yZSh0YXJnZXQubmV4dFNpYmxpbmcsIGNiLCB3aXRoVHJhbnNpdGlvbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuJGFwcGVuZFRvKHRhcmdldC5wYXJlbnROb2RlLCBjYiwgd2l0aFRyYW5zaXRpb24pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICAvKipcbiAgICogUmVtb3ZlIGluc3RhbmNlIGZyb20gRE9NXG4gICAqXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYl1cbiAgICogQHBhcmFtIHtCb29sZWFufSBbd2l0aFRyYW5zaXRpb25dIC0gZGVmYXVsdHMgdG8gdHJ1ZVxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLiRyZW1vdmUgPSBmdW5jdGlvbiAoY2IsIHdpdGhUcmFuc2l0aW9uKSB7XG4gICAgaWYgKCF0aGlzLiRlbC5wYXJlbnROb2RlKSB7XG4gICAgICByZXR1cm4gY2IgJiYgY2IoKTtcbiAgICB9XG4gICAgdmFyIGluRG9jdW1lbnQgPSB0aGlzLl9pc0F0dGFjaGVkICYmIGluRG9jKHRoaXMuJGVsKTtcbiAgICAvLyBpZiB3ZSBhcmUgbm90IGluIGRvY3VtZW50LCBubyBuZWVkIHRvIGNoZWNrXG4gICAgLy8gZm9yIHRyYW5zaXRpb25zXG4gICAgaWYgKCFpbkRvY3VtZW50KSB3aXRoVHJhbnNpdGlvbiA9IGZhbHNlO1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgcmVhbENiID0gZnVuY3Rpb24gcmVhbENiKCkge1xuICAgICAgaWYgKGluRG9jdW1lbnQpIHNlbGYuX2NhbGxIb29rKCdkZXRhY2hlZCcpO1xuICAgICAgaWYgKGNiKSBjYigpO1xuICAgIH07XG4gICAgaWYgKHRoaXMuX2lzRnJhZ21lbnQpIHtcbiAgICAgIHJlbW92ZU5vZGVSYW5nZSh0aGlzLl9mcmFnbWVudFN0YXJ0LCB0aGlzLl9mcmFnbWVudEVuZCwgdGhpcywgdGhpcy5fZnJhZ21lbnQsIHJlYWxDYik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBvcCA9IHdpdGhUcmFuc2l0aW9uID09PSBmYWxzZSA/IHJlbW92ZVdpdGhDYiA6IHJlbW92ZVdpdGhUcmFuc2l0aW9uO1xuICAgICAgb3AodGhpcy4kZWwsIHRoaXMsIHJlYWxDYik7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTaGFyZWQgRE9NIGluc2VydGlvbiBmdW5jdGlvbi5cbiAgICpcbiAgICogQHBhcmFtIHtWdWV9IHZtXG4gICAqIEBwYXJhbSB7RWxlbWVudH0gdGFyZ2V0XG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYl1cbiAgICogQHBhcmFtIHtCb29sZWFufSBbd2l0aFRyYW5zaXRpb25dXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IG9wMSAtIG9wIGZvciBub24tdHJhbnNpdGlvbiBpbnNlcnRcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gb3AyIC0gb3AgZm9yIHRyYW5zaXRpb24gaW5zZXJ0XG4gICAqIEByZXR1cm4gdm1cbiAgICovXG5cbiAgZnVuY3Rpb24gaW5zZXJ0KHZtLCB0YXJnZXQsIGNiLCB3aXRoVHJhbnNpdGlvbiwgb3AxLCBvcDIpIHtcbiAgICB0YXJnZXQgPSBxdWVyeSh0YXJnZXQpO1xuICAgIHZhciB0YXJnZXRJc0RldGFjaGVkID0gIWluRG9jKHRhcmdldCk7XG4gICAgdmFyIG9wID0gd2l0aFRyYW5zaXRpb24gPT09IGZhbHNlIHx8IHRhcmdldElzRGV0YWNoZWQgPyBvcDEgOiBvcDI7XG4gICAgdmFyIHNob3VsZENhbGxIb29rID0gIXRhcmdldElzRGV0YWNoZWQgJiYgIXZtLl9pc0F0dGFjaGVkICYmICFpbkRvYyh2bS4kZWwpO1xuICAgIGlmICh2bS5faXNGcmFnbWVudCkge1xuICAgICAgbWFwTm9kZVJhbmdlKHZtLl9mcmFnbWVudFN0YXJ0LCB2bS5fZnJhZ21lbnRFbmQsIGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgIG9wKG5vZGUsIHRhcmdldCwgdm0pO1xuICAgICAgfSk7XG4gICAgICBjYiAmJiBjYigpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvcCh2bS4kZWwsIHRhcmdldCwgdm0sIGNiKTtcbiAgICB9XG4gICAgaWYgKHNob3VsZENhbGxIb29rKSB7XG4gICAgICB2bS5fY2FsbEhvb2soJ2F0dGFjaGVkJyk7XG4gICAgfVxuICAgIHJldHVybiB2bTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayBmb3Igc2VsZWN0b3JzXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfEVsZW1lbnR9IGVsXG4gICAqL1xuXG4gIGZ1bmN0aW9uIHF1ZXJ5KGVsKSB7XG4gICAgcmV0dXJuIHR5cGVvZiBlbCA9PT0gJ3N0cmluZycgPyBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGVsKSA6IGVsO1xuICB9XG5cbiAgLyoqXG4gICAqIEFwcGVuZCBvcGVyYXRpb24gdGhhdCB0YWtlcyBhIGNhbGxiYWNrLlxuICAgKlxuICAgKiBAcGFyYW0ge05vZGV9IGVsXG4gICAqIEBwYXJhbSB7Tm9kZX0gdGFyZ2V0XG4gICAqIEBwYXJhbSB7VnVlfSB2bSAtIHVudXNlZFxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2JdXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGFwcGVuZChlbCwgdGFyZ2V0LCB2bSwgY2IpIHtcbiAgICB0YXJnZXQuYXBwZW5kQ2hpbGQoZWwpO1xuICAgIGlmIChjYikgY2IoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnNlcnRCZWZvcmUgb3BlcmF0aW9uIHRoYXQgdGFrZXMgYSBjYWxsYmFjay5cbiAgICpcbiAgICogQHBhcmFtIHtOb2RlfSBlbFxuICAgKiBAcGFyYW0ge05vZGV9IHRhcmdldFxuICAgKiBAcGFyYW0ge1Z1ZX0gdm0gLSB1bnVzZWRcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NiXVxuICAgKi9cblxuICBmdW5jdGlvbiBiZWZvcmVXaXRoQ2IoZWwsIHRhcmdldCwgdm0sIGNiKSB7XG4gICAgYmVmb3JlKGVsLCB0YXJnZXQpO1xuICAgIGlmIChjYikgY2IoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgb3BlcmF0aW9uIHRoYXQgdGFrZXMgYSBjYWxsYmFjay5cbiAgICpcbiAgICogQHBhcmFtIHtOb2RlfSBlbFxuICAgKiBAcGFyYW0ge1Z1ZX0gdm0gLSB1bnVzZWRcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NiXVxuICAgKi9cblxuICBmdW5jdGlvbiByZW1vdmVXaXRoQ2IoZWwsIHZtLCBjYikge1xuICAgIHJlbW92ZShlbCk7XG4gICAgaWYgKGNiKSBjYigpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGV2ZW50c0FQSSAoVnVlKSB7XG5cbiAgLyoqXG4gICAqIExpc3RlbiBvbiB0aGUgZ2l2ZW4gYGV2ZW50YCB3aXRoIGBmbmAuXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLiRvbiA9IGZ1bmN0aW9uIChldmVudCwgZm4pIHtcbiAgICAodGhpcy5fZXZlbnRzW2V2ZW50XSB8fCAodGhpcy5fZXZlbnRzW2V2ZW50XSA9IFtdKSkucHVzaChmbik7XG4gICAgbW9kaWZ5TGlzdGVuZXJDb3VudCh0aGlzLCBldmVudCwgMSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLyoqXG4gICAqIEFkZHMgYW4gYGV2ZW50YCBsaXN0ZW5lciB0aGF0IHdpbGwgYmUgaW52b2tlZCBhIHNpbmdsZVxuICAgKiB0aW1lIHRoZW4gYXV0b21hdGljYWxseSByZW1vdmVkLlxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cbiAgICovXG5cbiAgVnVlLnByb3RvdHlwZS4kb25jZSA9IGZ1bmN0aW9uIChldmVudCwgZm4pIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgZnVuY3Rpb24gb24oKSB7XG4gICAgICBzZWxmLiRvZmYoZXZlbnQsIG9uKTtcbiAgICAgIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICAgIG9uLmZuID0gZm47XG4gICAgdGhpcy4kb24oZXZlbnQsIG9uKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICAvKipcbiAgICogUmVtb3ZlIHRoZSBnaXZlbiBjYWxsYmFjayBmb3IgYGV2ZW50YCBvciBhbGxcbiAgICogcmVnaXN0ZXJlZCBjYWxsYmFja3MuXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLiRvZmYgPSBmdW5jdGlvbiAoZXZlbnQsIGZuKSB7XG4gICAgdmFyIGNicztcbiAgICAvLyBhbGxcbiAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIGlmICh0aGlzLiRwYXJlbnQpIHtcbiAgICAgICAgZm9yIChldmVudCBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgICAgICBjYnMgPSB0aGlzLl9ldmVudHNbZXZlbnRdO1xuICAgICAgICAgIGlmIChjYnMpIHtcbiAgICAgICAgICAgIG1vZGlmeUxpc3RlbmVyQ291bnQodGhpcywgZXZlbnQsIC1jYnMubGVuZ3RoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIC8vIHNwZWNpZmljIGV2ZW50XG4gICAgY2JzID0gdGhpcy5fZXZlbnRzW2V2ZW50XTtcbiAgICBpZiAoIWNicykge1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKSB7XG4gICAgICBtb2RpZnlMaXN0ZW5lckNvdW50KHRoaXMsIGV2ZW50LCAtY2JzLmxlbmd0aCk7XG4gICAgICB0aGlzLl9ldmVudHNbZXZlbnRdID0gbnVsbDtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICAvLyBzcGVjaWZpYyBoYW5kbGVyXG4gICAgdmFyIGNiO1xuICAgIHZhciBpID0gY2JzLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBjYiA9IGNic1tpXTtcbiAgICAgIGlmIChjYiA9PT0gZm4gfHwgY2IuZm4gPT09IGZuKSB7XG4gICAgICAgIG1vZGlmeUxpc3RlbmVyQ291bnQodGhpcywgZXZlbnQsIC0xKTtcbiAgICAgICAgY2JzLnNwbGljZShpLCAxKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBUcmlnZ2VyIGFuIGV2ZW50IG9uIHNlbGYuXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxuICAgKiBAcmV0dXJuIHtCb29sZWFufSBzaG91bGRQcm9wYWdhdGVcbiAgICovXG5cbiAgVnVlLnByb3RvdHlwZS4kZW1pdCA9IGZ1bmN0aW9uIChldmVudCkge1xuICAgIHZhciBjYnMgPSB0aGlzLl9ldmVudHNbZXZlbnRdO1xuICAgIHZhciBzaG91bGRQcm9wYWdhdGUgPSAhY2JzO1xuICAgIGlmIChjYnMpIHtcbiAgICAgIGNicyA9IGNicy5sZW5ndGggPiAxID8gdG9BcnJheShjYnMpIDogY2JzO1xuICAgICAgdmFyIGFyZ3MgPSB0b0FycmF5KGFyZ3VtZW50cywgMSk7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGNicy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgdmFyIHJlcyA9IGNic1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgaWYgKHJlcyA9PT0gdHJ1ZSkge1xuICAgICAgICAgIHNob3VsZFByb3BhZ2F0ZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHNob3VsZFByb3BhZ2F0ZTtcbiAgfTtcblxuICAvKipcbiAgICogUmVjdXJzaXZlbHkgYnJvYWRjYXN0IGFuIGV2ZW50IHRvIGFsbCBjaGlsZHJlbiBpbnN0YW5jZXMuXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxuICAgKiBAcGFyYW0gey4uLip9IGFkZGl0aW9uYWwgYXJndW1lbnRzXG4gICAqL1xuXG4gIFZ1ZS5wcm90b3R5cGUuJGJyb2FkY2FzdCA9IGZ1bmN0aW9uIChldmVudCkge1xuICAgIC8vIGlmIG5vIGNoaWxkIGhhcyByZWdpc3RlcmVkIGZvciB0aGlzIGV2ZW50LFxuICAgIC8vIHRoZW4gdGhlcmUncyBubyBuZWVkIHRvIGJyb2FkY2FzdC5cbiAgICBpZiAoIXRoaXMuX2V2ZW50c0NvdW50W2V2ZW50XSkgcmV0dXJuO1xuICAgIHZhciBjaGlsZHJlbiA9IHRoaXMuJGNoaWxkcmVuO1xuICAgIGZvciAodmFyIGkgPSAwLCBsID0gY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICB2YXIgY2hpbGQgPSBjaGlsZHJlbltpXTtcbiAgICAgIHZhciBzaG91bGRQcm9wYWdhdGUgPSBjaGlsZC4kZW1pdC5hcHBseShjaGlsZCwgYXJndW1lbnRzKTtcbiAgICAgIGlmIChzaG91bGRQcm9wYWdhdGUpIHtcbiAgICAgICAgY2hpbGQuJGJyb2FkY2FzdC5hcHBseShjaGlsZCwgYXJndW1lbnRzKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJlY3Vyc2l2ZWx5IHByb3BhZ2F0ZSBhbiBldmVudCB1cCB0aGUgcGFyZW50IGNoYWluLlxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcbiAgICogQHBhcmFtIHsuLi4qfSBhZGRpdGlvbmFsIGFyZ3VtZW50c1xuICAgKi9cblxuICBWdWUucHJvdG90eXBlLiRkaXNwYXRjaCA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLiRlbWl0LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgdmFyIHBhcmVudCA9IHRoaXMuJHBhcmVudDtcbiAgICB3aGlsZSAocGFyZW50KSB7XG4gICAgICB2YXIgc2hvdWxkUHJvcGFnYXRlID0gcGFyZW50LiRlbWl0LmFwcGx5KHBhcmVudCwgYXJndW1lbnRzKTtcbiAgICAgIHBhcmVudCA9IHNob3VsZFByb3BhZ2F0ZSA/IHBhcmVudC4kcGFyZW50IDogbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLyoqXG4gICAqIE1vZGlmeSB0aGUgbGlzdGVuZXIgY291bnRzIG9uIGFsbCBwYXJlbnRzLlxuICAgKiBUaGlzIGJvb2trZWVwaW5nIGFsbG93cyAkYnJvYWRjYXN0IHRvIHJldHVybiBlYXJseSB3aGVuXG4gICAqIG5vIGNoaWxkIGhhcyBsaXN0ZW5lZCB0byBhIGNlcnRhaW4gZXZlbnQuXG4gICAqXG4gICAqIEBwYXJhbSB7VnVlfSB2bVxuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGNvdW50XG4gICAqL1xuXG4gIHZhciBob29rUkUgPSAvXmhvb2s6LztcbiAgZnVuY3Rpb24gbW9kaWZ5TGlzdGVuZXJDb3VudCh2bSwgZXZlbnQsIGNvdW50KSB7XG4gICAgdmFyIHBhcmVudCA9IHZtLiRwYXJlbnQ7XG4gICAgLy8gaG9va3MgZG8gbm90IGdldCBicm9hZGNhc3RlZCBzbyBubyBuZWVkXG4gICAgLy8gdG8gZG8gYm9va2tlZXBpbmcgZm9yIHRoZW1cbiAgICBpZiAoIXBhcmVudCB8fCAhY291bnQgfHwgaG9va1JFLnRlc3QoZXZlbnQpKSByZXR1cm47XG4gICAgd2hpbGUgKHBhcmVudCkge1xuICAgICAgcGFyZW50Ll9ldmVudHNDb3VudFtldmVudF0gPSAocGFyZW50Ll9ldmVudHNDb3VudFtldmVudF0gfHwgMCkgKyBjb3VudDtcbiAgICAgIHBhcmVudCA9IHBhcmVudC4kcGFyZW50O1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBsaWZlY3ljbGVBUEkgKFZ1ZSkge1xuXG4gIC8qKlxuICAgKiBTZXQgaW5zdGFuY2UgdGFyZ2V0IGVsZW1lbnQgYW5kIGtpY2sgb2ZmIHRoZSBjb21waWxhdGlvblxuICAgKiBwcm9jZXNzLiBUaGUgcGFzc2VkIGluIGBlbGAgY2FuIGJlIGEgc2VsZWN0b3Igc3RyaW5nLCBhblxuICAgKiBleGlzdGluZyBFbGVtZW50LCBvciBhIERvY3VtZW50RnJhZ21lbnQgKGZvciBibG9ja1xuICAgKiBpbnN0YW5jZXMpLlxuICAgKlxuICAgKiBAcGFyYW0ge0VsZW1lbnR8RG9jdW1lbnRGcmFnbWVudHxzdHJpbmd9IGVsXG4gICAqIEBwdWJsaWNcbiAgICovXG5cbiAgVnVlLnByb3RvdHlwZS4kbW91bnQgPSBmdW5jdGlvbiAoZWwpIHtcbiAgICBpZiAodGhpcy5faXNDb21waWxlZCkge1xuICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB3YXJuKCckbW91bnQoKSBzaG91bGQgYmUgY2FsbGVkIG9ubHkgb25jZS4nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZWwgPSBxdWVyeShlbCk7XG4gICAgaWYgKCFlbCkge1xuICAgICAgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICB9XG4gICAgdGhpcy5fY29tcGlsZShlbCk7XG4gICAgdGhpcy5faW5pdERPTUhvb2tzKCk7XG4gICAgaWYgKGluRG9jKHRoaXMuJGVsKSkge1xuICAgICAgdGhpcy5fY2FsbEhvb2soJ2F0dGFjaGVkJyk7XG4gICAgICByZWFkeS5jYWxsKHRoaXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLiRvbmNlKCdob29rOmF0dGFjaGVkJywgcmVhZHkpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICAvKipcbiAgICogTWFyayBhbiBpbnN0YW5jZSBhcyByZWFkeS5cbiAgICovXG5cbiAgZnVuY3Rpb24gcmVhZHkoKSB7XG4gICAgdGhpcy5faXNBdHRhY2hlZCA9IHRydWU7XG4gICAgdGhpcy5faXNSZWFkeSA9IHRydWU7XG4gICAgdGhpcy5fY2FsbEhvb2soJ3JlYWR5Jyk7XG4gIH1cblxuICAvKipcbiAgICogVGVhcmRvd24gdGhlIGluc3RhbmNlLCBzaW1wbHkgZGVsZWdhdGUgdG8gdGhlIGludGVybmFsXG4gICAqIF9kZXN0cm95LlxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLiRkZXN0cm95ID0gZnVuY3Rpb24gKHJlbW92ZSwgZGVmZXJDbGVhbnVwKSB7XG4gICAgdGhpcy5fZGVzdHJveShyZW1vdmUsIGRlZmVyQ2xlYW51cCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFBhcnRpYWxseSBjb21waWxlIGEgcGllY2Ugb2YgRE9NIGFuZCByZXR1cm4gYVxuICAgKiBkZWNvbXBpbGUgZnVuY3Rpb24uXG4gICAqXG4gICAqIEBwYXJhbSB7RWxlbWVudHxEb2N1bWVudEZyYWdtZW50fSBlbFxuICAgKiBAcGFyYW0ge1Z1ZX0gW2hvc3RdXG4gICAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLiRjb21waWxlID0gZnVuY3Rpb24gKGVsLCBob3N0LCBzY29wZSwgZnJhZykge1xuICAgIHJldHVybiBjb21waWxlKGVsLCB0aGlzLiRvcHRpb25zLCB0cnVlKSh0aGlzLCBlbCwgaG9zdCwgc2NvcGUsIGZyYWcpO1xuICB9O1xufVxuXG4vKipcbiAqIFRoZSBleHBvc2VkIFZ1ZSBjb25zdHJ1Y3Rvci5cbiAqXG4gKiBBUEkgY29udmVudGlvbnM6XG4gKiAtIHB1YmxpYyBBUEkgbWV0aG9kcy9wcm9wZXJ0aWVzIGFyZSBwcmVmaXhlZCB3aXRoIGAkYFxuICogLSBpbnRlcm5hbCBtZXRob2RzL3Byb3BlcnRpZXMgYXJlIHByZWZpeGVkIHdpdGggYF9gXG4gKiAtIG5vbi1wcmVmaXhlZCBwcm9wZXJ0aWVzIGFyZSBhc3N1bWVkIHRvIGJlIHByb3hpZWQgdXNlclxuICogICBkYXRhLlxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICogQHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIFZ1ZShvcHRpb25zKSB7XG4gIHRoaXMuX2luaXQob3B0aW9ucyk7XG59XG5cbi8vIGluc3RhbGwgaW50ZXJuYWxzXG5pbml0TWl4aW4oVnVlKTtcbnN0YXRlTWl4aW4oVnVlKTtcbmV2ZW50c01peGluKFZ1ZSk7XG5saWZlY3ljbGVNaXhpbihWdWUpO1xubWlzY01peGluKFZ1ZSk7XG5cbi8vIGluc3RhbGwgQVBJc1xuZ2xvYmFsQVBJKFZ1ZSk7XG5kYXRhQVBJKFZ1ZSk7XG5kb21BUEkoVnVlKTtcbmV2ZW50c0FQSShWdWUpO1xubGlmZWN5Y2xlQVBJKFZ1ZSk7XG5cbnZhciBjb252ZXJ0QXJyYXkgPSB2Rm9yLl9wb3N0UHJvY2VzcztcblxuLyoqXG4gKiBMaW1pdCBmaWx0ZXIgZm9yIGFycmF5c1xuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBuXG4gKiBAcGFyYW0ge051bWJlcn0gb2Zmc2V0IChEZWNpbWFsIGV4cGVjdGVkKVxuICovXG5cbmZ1bmN0aW9uIGxpbWl0QnkoYXJyLCBuLCBvZmZzZXQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID8gcGFyc2VJbnQob2Zmc2V0LCAxMCkgOiAwO1xuICByZXR1cm4gdHlwZW9mIG4gPT09ICdudW1iZXInID8gYXJyLnNsaWNlKG9mZnNldCwgb2Zmc2V0ICsgbikgOiBhcnI7XG59XG5cbi8qKlxuICogRmlsdGVyIGZpbHRlciBmb3IgYXJyYXlzXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHNlYXJjaFxuICogQHBhcmFtIHtTdHJpbmd9IFtkZWxpbWl0ZXJdXG4gKiBAcGFyYW0ge1N0cmluZ30gLi4uZGF0YUtleXNcbiAqL1xuXG5mdW5jdGlvbiBmaWx0ZXJCeShhcnIsIHNlYXJjaCwgZGVsaW1pdGVyKSB7XG4gIGFyciA9IGNvbnZlcnRBcnJheShhcnIpO1xuICBpZiAoc2VhcmNoID09IG51bGwpIHtcbiAgICByZXR1cm4gYXJyO1xuICB9XG4gIGlmICh0eXBlb2Ygc2VhcmNoID09PSAnZnVuY3Rpb24nKSB7XG4gICAgcmV0dXJuIGFyci5maWx0ZXIoc2VhcmNoKTtcbiAgfVxuICAvLyBjYXN0IHRvIGxvd2VyY2FzZSBzdHJpbmdcbiAgc2VhcmNoID0gKCcnICsgc2VhcmNoKS50b0xvd2VyQ2FzZSgpO1xuICAvLyBhbGxvdyBvcHRpb25hbCBgaW5gIGRlbGltaXRlclxuICAvLyBiZWNhdXNlIHdoeSBub3RcbiAgdmFyIG4gPSBkZWxpbWl0ZXIgPT09ICdpbicgPyAzIDogMjtcbiAgLy8gZXh0cmFjdCBhbmQgZmxhdHRlbiBrZXlzXG4gIHZhciBrZXlzID0gdG9BcnJheShhcmd1bWVudHMsIG4pLnJlZHVjZShmdW5jdGlvbiAocHJldiwgY3VyKSB7XG4gICAgcmV0dXJuIHByZXYuY29uY2F0KGN1cik7XG4gIH0sIFtdKTtcbiAgdmFyIHJlcyA9IFtdO1xuICB2YXIgaXRlbSwga2V5LCB2YWwsIGo7XG4gIGZvciAodmFyIGkgPSAwLCBsID0gYXJyLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGl0ZW0gPSBhcnJbaV07XG4gICAgdmFsID0gaXRlbSAmJiBpdGVtLiR2YWx1ZSB8fCBpdGVtO1xuICAgIGogPSBrZXlzLmxlbmd0aDtcbiAgICBpZiAoaikge1xuICAgICAgd2hpbGUgKGotLSkge1xuICAgICAgICBrZXkgPSBrZXlzW2pdO1xuICAgICAgICBpZiAoa2V5ID09PSAnJGtleScgJiYgY29udGFpbnMoaXRlbS4ka2V5LCBzZWFyY2gpIHx8IGNvbnRhaW5zKGdldFBhdGgodmFsLCBrZXkpLCBzZWFyY2gpKSB7XG4gICAgICAgICAgcmVzLnB1c2goaXRlbSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGNvbnRhaW5zKGl0ZW0sIHNlYXJjaCkpIHtcbiAgICAgIHJlcy5wdXNoKGl0ZW0pO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzO1xufVxuXG4vKipcbiAqIEZpbHRlciBmaWx0ZXIgZm9yIGFycmF5c1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzb3J0S2V5XG4gKiBAcGFyYW0ge1N0cmluZ30gcmV2ZXJzZVxuICovXG5cbmZ1bmN0aW9uIG9yZGVyQnkoYXJyLCBzb3J0S2V5LCByZXZlcnNlKSB7XG4gIGFyciA9IGNvbnZlcnRBcnJheShhcnIpO1xuICBpZiAoIXNvcnRLZXkpIHtcbiAgICByZXR1cm4gYXJyO1xuICB9XG4gIHZhciBvcmRlciA9IHJldmVyc2UgJiYgcmV2ZXJzZSA8IDAgPyAtMSA6IDE7XG4gIC8vIHNvcnQgb24gYSBjb3B5IHRvIGF2b2lkIG11dGF0aW5nIG9yaWdpbmFsIGFycmF5XG4gIHJldHVybiBhcnIuc2xpY2UoKS5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgaWYgKHNvcnRLZXkgIT09ICcka2V5Jykge1xuICAgICAgaWYgKGlzT2JqZWN0KGEpICYmICckdmFsdWUnIGluIGEpIGEgPSBhLiR2YWx1ZTtcbiAgICAgIGlmIChpc09iamVjdChiKSAmJiAnJHZhbHVlJyBpbiBiKSBiID0gYi4kdmFsdWU7XG4gICAgfVxuICAgIGEgPSBpc09iamVjdChhKSA/IGdldFBhdGgoYSwgc29ydEtleSkgOiBhO1xuICAgIGIgPSBpc09iamVjdChiKSA/IGdldFBhdGgoYiwgc29ydEtleSkgOiBiO1xuICAgIHJldHVybiBhID09PSBiID8gMCA6IGEgPiBiID8gb3JkZXIgOiAtb3JkZXI7XG4gIH0pO1xufVxuXG4vKipcbiAqIFN0cmluZyBjb250YWluIGhlbHBlclxuICpcbiAqIEBwYXJhbSB7Kn0gdmFsXG4gKiBAcGFyYW0ge1N0cmluZ30gc2VhcmNoXG4gKi9cblxuZnVuY3Rpb24gY29udGFpbnModmFsLCBzZWFyY2gpIHtcbiAgdmFyIGk7XG4gIGlmIChpc1BsYWluT2JqZWN0KHZhbCkpIHtcbiAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHZhbCk7XG4gICAgaSA9IGtleXMubGVuZ3RoO1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGlmIChjb250YWlucyh2YWxba2V5c1tpXV0sIHNlYXJjaCkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzQXJyYXkodmFsKSkge1xuICAgIGkgPSB2YWwubGVuZ3RoO1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGlmIChjb250YWlucyh2YWxbaV0sIHNlYXJjaCkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2UgaWYgKHZhbCAhPSBudWxsKSB7XG4gICAgcmV0dXJuIHZhbC50b1N0cmluZygpLnRvTG93ZXJDYXNlKCkuaW5kZXhPZihzZWFyY2gpID4gLTE7XG4gIH1cbn1cblxudmFyIGRpZ2l0c1JFID0gLyhcXGR7M30pKD89XFxkKS9nO1xuXG4vLyBhc3NldCBjb2xsZWN0aW9ucyBtdXN0IGJlIGEgcGxhaW4gb2JqZWN0LlxudmFyIGZpbHRlcnMgPSB7XG5cbiAgb3JkZXJCeTogb3JkZXJCeSxcbiAgZmlsdGVyQnk6IGZpbHRlckJ5LFxuICBsaW1pdEJ5OiBsaW1pdEJ5LFxuXG4gIC8qKlxuICAgKiBTdHJpbmdpZnkgdmFsdWUuXG4gICAqXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBpbmRlbnRcbiAgICovXG5cbiAganNvbjoge1xuICAgIHJlYWQ6IGZ1bmN0aW9uIHJlYWQodmFsdWUsIGluZGVudCkge1xuICAgICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgPyB2YWx1ZSA6IEpTT04uc3RyaW5naWZ5KHZhbHVlLCBudWxsLCBOdW1iZXIoaW5kZW50KSB8fCAyKTtcbiAgICB9LFxuICAgIHdyaXRlOiBmdW5jdGlvbiB3cml0ZSh2YWx1ZSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UodmFsdWUpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiAnYWJjJyA9PiAnQWJjJ1xuICAgKi9cblxuICBjYXBpdGFsaXplOiBmdW5jdGlvbiBjYXBpdGFsaXplKHZhbHVlKSB7XG4gICAgaWYgKCF2YWx1ZSAmJiB2YWx1ZSAhPT0gMCkgcmV0dXJuICcnO1xuICAgIHZhbHVlID0gdmFsdWUudG9TdHJpbmcoKTtcbiAgICByZXR1cm4gdmFsdWUuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyB2YWx1ZS5zbGljZSgxKTtcbiAgfSxcblxuICAvKipcbiAgICogJ2FiYycgPT4gJ0FCQydcbiAgICovXG5cbiAgdXBwZXJjYXNlOiBmdW5jdGlvbiB1cHBlcmNhc2UodmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWUgfHwgdmFsdWUgPT09IDAgPyB2YWx1ZS50b1N0cmluZygpLnRvVXBwZXJDYXNlKCkgOiAnJztcbiAgfSxcblxuICAvKipcbiAgICogJ0FiQycgPT4gJ2FiYydcbiAgICovXG5cbiAgbG93ZXJjYXNlOiBmdW5jdGlvbiBsb3dlcmNhc2UodmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWUgfHwgdmFsdWUgPT09IDAgPyB2YWx1ZS50b1N0cmluZygpLnRvTG93ZXJDYXNlKCkgOiAnJztcbiAgfSxcblxuICAvKipcbiAgICogMTIzNDUgPT4gJDEyLDM0NS4wMFxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gc2lnblxuICAgKi9cblxuICBjdXJyZW5jeTogZnVuY3Rpb24gY3VycmVuY3kodmFsdWUsIF9jdXJyZW5jeSkge1xuICAgIHZhbHVlID0gcGFyc2VGbG9hdCh2YWx1ZSk7XG4gICAgaWYgKCFpc0Zpbml0ZSh2YWx1ZSkgfHwgIXZhbHVlICYmIHZhbHVlICE9PSAwKSByZXR1cm4gJyc7XG4gICAgX2N1cnJlbmN5ID0gX2N1cnJlbmN5ICE9IG51bGwgPyBfY3VycmVuY3kgOiAnJCc7XG4gICAgdmFyIHN0cmluZ2lmaWVkID0gTWF0aC5hYnModmFsdWUpLnRvRml4ZWQoMik7XG4gICAgdmFyIF9pbnQgPSBzdHJpbmdpZmllZC5zbGljZSgwLCAtMyk7XG4gICAgdmFyIGkgPSBfaW50Lmxlbmd0aCAlIDM7XG4gICAgdmFyIGhlYWQgPSBpID4gMCA/IF9pbnQuc2xpY2UoMCwgaSkgKyAoX2ludC5sZW5ndGggPiAzID8gJywnIDogJycpIDogJyc7XG4gICAgdmFyIF9mbG9hdCA9IHN0cmluZ2lmaWVkLnNsaWNlKC0zKTtcbiAgICB2YXIgc2lnbiA9IHZhbHVlIDwgMCA/ICctJyA6ICcnO1xuICAgIHJldHVybiBfY3VycmVuY3kgKyBzaWduICsgaGVhZCArIF9pbnQuc2xpY2UoaSkucmVwbGFjZShkaWdpdHNSRSwgJyQxLCcpICsgX2Zsb2F0O1xuICB9LFxuXG4gIC8qKlxuICAgKiAnaXRlbScgPT4gJ2l0ZW1zJ1xuICAgKlxuICAgKiBAcGFyYW1zXG4gICAqICBhbiBhcnJheSBvZiBzdHJpbmdzIGNvcnJlc3BvbmRpbmcgdG9cbiAgICogIHRoZSBzaW5nbGUsIGRvdWJsZSwgdHJpcGxlIC4uLiBmb3JtcyBvZiB0aGUgd29yZCB0b1xuICAgKiAgYmUgcGx1cmFsaXplZC4gV2hlbiB0aGUgbnVtYmVyIHRvIGJlIHBsdXJhbGl6ZWRcbiAgICogIGV4Y2VlZHMgdGhlIGxlbmd0aCBvZiB0aGUgYXJncywgaXQgd2lsbCB1c2UgdGhlIGxhc3RcbiAgICogIGVudHJ5IGluIHRoZSBhcnJheS5cbiAgICpcbiAgICogIGUuZy4gWydzaW5nbGUnLCAnZG91YmxlJywgJ3RyaXBsZScsICdtdWx0aXBsZSddXG4gICAqL1xuXG4gIHBsdXJhbGl6ZTogZnVuY3Rpb24gcGx1cmFsaXplKHZhbHVlKSB7XG4gICAgdmFyIGFyZ3MgPSB0b0FycmF5KGFyZ3VtZW50cywgMSk7XG4gICAgcmV0dXJuIGFyZ3MubGVuZ3RoID4gMSA/IGFyZ3NbdmFsdWUgJSAxMCAtIDFdIHx8IGFyZ3NbYXJncy5sZW5ndGggLSAxXSA6IGFyZ3NbMF0gKyAodmFsdWUgPT09IDEgPyAnJyA6ICdzJyk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIERlYm91bmNlIGEgaGFuZGxlciBmdW5jdGlvbi5cbiAgICpcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gaGFuZGxlclxuICAgKiBAcGFyYW0ge051bWJlcn0gZGVsYXkgPSAzMDBcbiAgICogQHJldHVybiB7RnVuY3Rpb259XG4gICAqL1xuXG4gIGRlYm91bmNlOiBmdW5jdGlvbiBkZWJvdW5jZShoYW5kbGVyLCBkZWxheSkge1xuICAgIGlmICghaGFuZGxlcikgcmV0dXJuO1xuICAgIGlmICghZGVsYXkpIHtcbiAgICAgIGRlbGF5ID0gMzAwO1xuICAgIH1cbiAgICByZXR1cm4gX2RlYm91bmNlKGhhbmRsZXIsIGRlbGF5KTtcbiAgfVxufTtcblxudmFyIHBhcnRpYWwgPSB7XG5cbiAgcHJpb3JpdHk6IFBBUlRJQUwsXG5cbiAgcGFyYW1zOiBbJ25hbWUnXSxcblxuICAvLyB3YXRjaCBjaGFuZ2VzIHRvIG5hbWUgZm9yIGR5bmFtaWMgcGFydGlhbHNcbiAgcGFyYW1XYXRjaGVyczoge1xuICAgIG5hbWU6IGZ1bmN0aW9uIG5hbWUodmFsdWUpIHtcbiAgICAgIHZJZi5yZW1vdmUuY2FsbCh0aGlzKTtcbiAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICB0aGlzLmluc2VydCh2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIGJpbmQ6IGZ1bmN0aW9uIGJpbmQoKSB7XG4gICAgdGhpcy5hbmNob3IgPSBjcmVhdGVBbmNob3IoJ3YtcGFydGlhbCcpO1xuICAgIHJlcGxhY2UodGhpcy5lbCwgdGhpcy5hbmNob3IpO1xuICAgIHRoaXMuaW5zZXJ0KHRoaXMucGFyYW1zLm5hbWUpO1xuICB9LFxuXG4gIGluc2VydDogZnVuY3Rpb24gaW5zZXJ0KGlkKSB7XG4gICAgdmFyIHBhcnRpYWwgPSByZXNvbHZlQXNzZXQodGhpcy52bS4kb3B0aW9ucywgJ3BhcnRpYWxzJywgaWQpO1xuICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICBhc3NlcnRBc3NldChwYXJ0aWFsLCAncGFydGlhbCcsIGlkKTtcbiAgICB9XG4gICAgaWYgKHBhcnRpYWwpIHtcbiAgICAgIHRoaXMuZmFjdG9yeSA9IG5ldyBGcmFnbWVudEZhY3RvcnkodGhpcy52bSwgcGFydGlhbCk7XG4gICAgICB2SWYuaW5zZXJ0LmNhbGwodGhpcyk7XG4gICAgfVxuICB9LFxuXG4gIHVuYmluZDogZnVuY3Rpb24gdW5iaW5kKCkge1xuICAgIGlmICh0aGlzLmZyYWcpIHtcbiAgICAgIHRoaXMuZnJhZy5kZXN0cm95KCk7XG4gICAgfVxuICB9XG59O1xuXG4vLyBUaGlzIGlzIHRoZSBlbGVtZW50RGlyZWN0aXZlIHRoYXQgaGFuZGxlcyA8Y29udGVudD5cbi8vIHRyYW5zY2x1c2lvbnMuIEl0IHJlbGllcyBvbiB0aGUgcmF3IGNvbnRlbnQgb2YgYW5cbi8vIGluc3RhbmNlIGJlaW5nIHN0b3JlZCBhcyBgJG9wdGlvbnMuX2NvbnRlbnRgIGR1cmluZ1xuLy8gdGhlIHRyYW5zY2x1ZGUgcGhhc2UuXG5cbi8vIFdlIGFyZSBleHBvcnRpbmcgdHdvIHZlcnNpb25zLCBvbmUgZm9yIG5hbWVkIGFuZCBvbmVcbi8vIGZvciB1bm5hbWVkLCBiZWNhdXNlIHRoZSB1bm5hbWVkIHNsb3RzIG11c3QgYmUgY29tcGlsZWRcbi8vIEFGVEVSIGFsbCBuYW1lZCBzbG90cyBoYXZlIHNlbGVjdGVkIHRoZWlyIGNvbnRlbnQuIFNvXG4vLyB3ZSBuZWVkIHRvIGdpdmUgdGhlbSBkaWZmZXJlbnQgcHJpb3JpdGllcyBpbiB0aGUgY29tcGlsYXRpb25cbi8vIHByb2Nlc3MuIChTZWUgIzE5NjUpXG5cbnZhciBzbG90ID0ge1xuXG4gIHByaW9yaXR5OiBTTE9ULFxuXG4gIGJpbmQ6IGZ1bmN0aW9uIGJpbmQoKSB7XG4gICAgdmFyIGhvc3QgPSB0aGlzLnZtO1xuICAgIHZhciByYXcgPSBob3N0LiRvcHRpb25zLl9jb250ZW50O1xuICAgIGlmICghcmF3KSB7XG4gICAgICB0aGlzLmZhbGxiYWNrKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciBjb250ZXh0ID0gaG9zdC5fY29udGV4dDtcbiAgICB2YXIgc2xvdE5hbWUgPSB0aGlzLnBhcmFtcyAmJiB0aGlzLnBhcmFtcy5uYW1lO1xuICAgIGlmICghc2xvdE5hbWUpIHtcbiAgICAgIC8vIERlZmF1bHQgc2xvdFxuICAgICAgdGhpcy50cnlDb21waWxlKGV4dHJhY3RGcmFnbWVudChyYXcuY2hpbGROb2RlcywgcmF3LCB0cnVlKSwgY29udGV4dCwgaG9zdCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE5hbWVkIHNsb3RcbiAgICAgIHZhciBzZWxlY3RvciA9ICdbc2xvdD1cIicgKyBzbG90TmFtZSArICdcIl0nO1xuICAgICAgdmFyIG5vZGVzID0gcmF3LnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3IpO1xuICAgICAgaWYgKG5vZGVzLmxlbmd0aCkge1xuICAgICAgICB0aGlzLnRyeUNvbXBpbGUoZXh0cmFjdEZyYWdtZW50KG5vZGVzLCByYXcpLCBjb250ZXh0LCBob3N0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZmFsbGJhY2soKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgdHJ5Q29tcGlsZTogZnVuY3Rpb24gdHJ5Q29tcGlsZShjb250ZW50LCBjb250ZXh0LCBob3N0KSB7XG4gICAgaWYgKGNvbnRlbnQuaGFzQ2hpbGROb2RlcygpKSB7XG4gICAgICB0aGlzLmNvbXBpbGUoY29udGVudCwgY29udGV4dCwgaG9zdCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZmFsbGJhY2soKTtcbiAgICB9XG4gIH0sXG5cbiAgY29tcGlsZTogZnVuY3Rpb24gY29tcGlsZShjb250ZW50LCBjb250ZXh0LCBob3N0KSB7XG4gICAgaWYgKGNvbnRlbnQgJiYgY29udGV4dCkge1xuICAgICAgdmFyIHNjb3BlID0gaG9zdCA/IGhvc3QuX3Njb3BlIDogdGhpcy5fc2NvcGU7XG4gICAgICB0aGlzLnVubGluayA9IGNvbnRleHQuJGNvbXBpbGUoY29udGVudCwgaG9zdCwgc2NvcGUsIHRoaXMuX2ZyYWcpO1xuICAgIH1cbiAgICBpZiAoY29udGVudCkge1xuICAgICAgcmVwbGFjZSh0aGlzLmVsLCBjb250ZW50KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVtb3ZlKHRoaXMuZWwpO1xuICAgIH1cbiAgfSxcblxuICBmYWxsYmFjazogZnVuY3Rpb24gZmFsbGJhY2soKSB7XG4gICAgdGhpcy5jb21waWxlKGV4dHJhY3RDb250ZW50KHRoaXMuZWwsIHRydWUpLCB0aGlzLnZtKTtcbiAgfSxcblxuICB1bmJpbmQ6IGZ1bmN0aW9uIHVuYmluZCgpIHtcbiAgICBpZiAodGhpcy51bmxpbmspIHtcbiAgICAgIHRoaXMudW5saW5rKCk7XG4gICAgfVxuICB9XG59O1xuXG52YXIgbmFtZWRTbG90ID0gZXh0ZW5kKGV4dGVuZCh7fSwgc2xvdCksIHtcbiAgcHJpb3JpdHk6IHNsb3QucHJpb3JpdHkgKyAxLFxuICBwYXJhbXM6IFsnbmFtZSddXG59KTtcblxuLyoqXG4gKiBFeHRyYWN0IHF1YWxpZmllZCBjb250ZW50IG5vZGVzIGZyb20gYSBub2RlIGxpc3QuXG4gKlxuICogQHBhcmFtIHtOb2RlTGlzdH0gbm9kZXNcbiAqIEBwYXJhbSB7RWxlbWVudH0gcGFyZW50XG4gKiBAcGFyYW0ge0Jvb2xlYW59IG1haW5cbiAqIEByZXR1cm4ge0RvY3VtZW50RnJhZ21lbnR9XG4gKi9cblxuZnVuY3Rpb24gZXh0cmFjdEZyYWdtZW50KG5vZGVzLCBwYXJlbnQsIG1haW4pIHtcbiAgdmFyIGZyYWcgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG4gIGZvciAodmFyIGkgPSAwLCBsID0gbm9kZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgdmFyIG5vZGUgPSBub2Rlc1tpXTtcbiAgICAvLyBpZiB0aGlzIGlzIHRoZSBtYWluIG91dGxldCwgd2Ugd2FudCB0byBza2lwIGFsbFxuICAgIC8vIHByZXZpb3VzbHkgc2VsZWN0ZWQgbm9kZXM7XG4gICAgLy8gb3RoZXJ3aXNlLCB3ZSB3YW50IHRvIG1hcmsgdGhlIG5vZGUgYXMgc2VsZWN0ZWQuXG4gICAgLy8gY2xvbmUgdGhlIG5vZGUgc28gdGhlIG9yaWdpbmFsIHJhdyBjb250ZW50IHJlbWFpbnNcbiAgICAvLyBpbnRhY3QuIHRoaXMgZW5zdXJlcyBwcm9wZXIgcmUtY29tcGlsYXRpb24gaW4gY2FzZXNcbiAgICAvLyB3aGVyZSB0aGUgb3V0bGV0IGlzIGluc2lkZSBhIGNvbmRpdGlvbmFsIGJsb2NrXG4gICAgaWYgKG1haW4gJiYgIW5vZGUuX192X3NlbGVjdGVkKSB7XG4gICAgICBhcHBlbmQobm9kZSk7XG4gICAgfSBlbHNlIGlmICghbWFpbiAmJiBub2RlLnBhcmVudE5vZGUgPT09IHBhcmVudCkge1xuICAgICAgbm9kZS5fX3Zfc2VsZWN0ZWQgPSB0cnVlO1xuICAgICAgYXBwZW5kKG5vZGUpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZnJhZztcblxuICBmdW5jdGlvbiBhcHBlbmQobm9kZSkge1xuICAgIGlmIChpc1RlbXBsYXRlKG5vZGUpICYmICFub2RlLmhhc0F0dHJpYnV0ZSgndi1pZicpICYmICFub2RlLmhhc0F0dHJpYnV0ZSgndi1mb3InKSkge1xuICAgICAgbm9kZSA9IHBhcnNlVGVtcGxhdGUobm9kZSk7XG4gICAgfVxuICAgIG5vZGUgPSBjbG9uZU5vZGUobm9kZSk7XG4gICAgZnJhZy5hcHBlbmRDaGlsZChub2RlKTtcbiAgfVxufVxuXG52YXIgZWxlbWVudERpcmVjdGl2ZXMgPSB7XG4gIHNsb3Q6IHNsb3QsXG4gIF9uYW1lZFNsb3Q6IG5hbWVkU2xvdCwgLy8gc2FtZSBhcyBzbG90IGJ1dCB3aXRoIGhpZ2hlciBwcmlvcml0eVxuICBwYXJ0aWFsOiBwYXJ0aWFsXG59O1xuXG5WdWUudmVyc2lvbiA9ICcxLjAuMTMnO1xuXG4vKipcbiAqIFZ1ZSBhbmQgZXZlcnkgY29uc3RydWN0b3IgdGhhdCBleHRlbmRzIFZ1ZSBoYXMgYW5cbiAqIGFzc29jaWF0ZWQgb3B0aW9ucyBvYmplY3QsIHdoaWNoIGNhbiBiZSBhY2Nlc3NlZCBkdXJpbmdcbiAqIGNvbXBpbGF0aW9uIHN0ZXBzIGFzIGB0aGlzLmNvbnN0cnVjdG9yLm9wdGlvbnNgLlxuICpcbiAqIFRoZXNlIGNhbiBiZSBzZWVuIGFzIHRoZSBkZWZhdWx0IG9wdGlvbnMgb2YgZXZlcnlcbiAqIFZ1ZSBpbnN0YW5jZS5cbiAqL1xuXG5WdWUub3B0aW9ucyA9IHtcbiAgZGlyZWN0aXZlczogcHVibGljRGlyZWN0aXZlcyxcbiAgZWxlbWVudERpcmVjdGl2ZXM6IGVsZW1lbnREaXJlY3RpdmVzLFxuICBmaWx0ZXJzOiBmaWx0ZXJzLFxuICB0cmFuc2l0aW9uczoge30sXG4gIGNvbXBvbmVudHM6IHt9LFxuICBwYXJ0aWFsczoge30sXG4gIHJlcGxhY2U6IHRydWVcbn07XG5cbi8vIGRldnRvb2xzIGdsb2JhbCBob29rXG4vKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbmlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIGluQnJvd3Nlcikge1xuICBpZiAod2luZG93Ll9fVlVFX0RFVlRPT0xTX0dMT0JBTF9IT09LX18pIHtcbiAgICB3aW5kb3cuX19WVUVfREVWVE9PTFNfR0xPQkFMX0hPT0tfXy5lbWl0KCdpbml0JywgVnVlKTtcbiAgfSBlbHNlIGlmICgvQ2hyb21lXFwvXFxkKy8udGVzdChuYXZpZ2F0b3IudXNlckFnZW50KSkge1xuICAgIGNvbnNvbGUubG9nKCdEb3dubG9hZCB0aGUgVnVlIERldnRvb2xzIGZvciBhIGJldHRlciBkZXZlbG9wbWVudCBleHBlcmllbmNlOlxcbicgKyAnaHR0cHM6Ly9naXRodWIuY29tL3Z1ZWpzL3Z1ZS1kZXZ0b29scycpO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gVnVlOyIsIid1c2Ugc3RyaWN0Jztcbi8qKlxuKk1vZHVsZSBkZXBlbmRlbmNpZXNcbiovXG52YXIgVnVlID0gcmVxdWlyZSgndnVlJyk7XG4vLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4qTW9kdWxlIGNvbmZpZ1xuKi9cblZ1ZS51c2UocmVxdWlyZSgndnVlLXJlc291cmNlJykpO1xuVnVlLmh0dHAub3B0aW9ucy5yb290ID0gJy9yb290JztcblZ1ZS5odHRwLmhlYWRlcnMuY29tbW9uWydBdXRob3JpemF0aW9uJ10gPSAnQmFzaWMgWVhCcE9uQmhjM04zYjNKayc7XG4vLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4qQ3JlYXRlIGNvbXBvbmVudHNcbiovXG4vLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxudmFyXG4gIGFwcEdsb2JhbHMgPSB7XG4gICAgcGVyc29uOiB3aW5kb3cuYXBwVXNlckRhdGEucGVyc29uLFxuICAgIGN1cnJlbnRQcm9maWxlOiB3aW5kb3cuYXBwVXNlckRhdGEuY3VycmVudFByb2ZpbGUsXG4gICAgZmFjZWJvb2s6IHtcbiAgICAgIG5hbWU6IHdpbmRvdy5hcHBVc2VyRGF0YS5mYk5hbWUsXG4gICAgICBlbWFpbDogd2luZG93LmFwcFVzZXJEYXRhLmZiRW1haWxcbiAgICB9LFxuICAgIHR3aXR0ZXI6IHtcbiAgICAgIGhhbmRsZTogd2luZG93LmFwcFVzZXJEYXRhLnR3aXR0ZXJIYW5kbGUsXG4gICAgICBsb2NhdGlvbjogd2luZG93LmFwcFVzZXJEYXRhLnR3aXR0ZXJMb2NhdGlvbixcbiAgICAgIGRlc2NyaXB0aW9uOiB3aW5kb3cuYXBwVXNlckRhdGEudHdpdHRlckRlc2NyaXB0aW9uXG4gICAgfSxcbiAgICBsb2NhbDoge1xuICAgICAgdXNlcm5hbWU6IHdpbmRvdy5hcHBVc2VyRGF0YS5sb2NhbFVzZXIsXG4gICAgICBlbWFpbDogd2luZG93LmFwcFVzZXJEYXRhLmxvY2FsRW1haWxcbiAgICB9LFxuICAgIHVzZXJQaG90bzogd2luZG93LmFwcFVzZXJEYXRhLnVzZXJQaG90byxcbiAgICBmYlVSTDogJy9mYWNlYm9vaycsXG4gICAgdHdpdHRlclVSTDogJy90d2l0dGVyL3N0YXR1c2VzL2hvbWVfdGltZWxpbmUnLFxuICAgIGxpbmtTdGF0dXM6IHtcbiAgICAgIGxvY2FsOiB3aW5kb3cuYXBwVXNlckRhdGEubG9jYWxMaW5rU3RhdHVzLFxuICAgICAgZmI6IHdpbmRvdy5hcHBVc2VyRGF0YS5mYkxpbmtTdGF0dXMsXG4gICAgICB0d2l0dGVyOiB3aW5kb3cuYXBwVXNlckRhdGEudHdpdHRlckxpbmtTdGF0dXNcbiAgICB9LFxuICAgIGhpZGVMaW5rQWNjdDogd2luZG93LmFwcFVzZXJEYXRhLmhpZGVMaW5rQWNjdCxcbiAgICBoaWRlTG9jYWxMaW5rOiB3aW5kb3cuYXBwVXNlckRhdGEuaGlkZUxvY2FsTGluayxcbiAgICBoaWRlRkJMaW5rOiB3aW5kb3cuYXBwVXNlckRhdGEuaGlkZUZCTGluayxcbiAgICBoaWRlVHdpdHRlckxpbms6IHdpbmRvdy5hcHBVc2VyRGF0YS5oaWRlVHdpdHRlckxpbmtcbiAgfSxcbiAgYXBwTmF2ID0gcmVxdWlyZSgnLi9jb21wb25lbnRzL25hdicpLFxuICBhcHBQcm9maWxlID0gcmVxdWlyZSgnLi9jb21wb25lbnRzL3Byb2ZpbGUnKShhcHBHbG9iYWxzKSxcbiAgYXBwTG9jYWwgPSByZXF1aXJlKCcuL2NvbXBvbmVudHMvbG9jYWwnKShhcHBHbG9iYWxzKSxcbiAgYXBwRmFjZWJvb2sgPSByZXF1aXJlKCcuL2NvbXBvbmVudHMvZmFjZWJvb2snKShhcHBHbG9iYWxzKSxcbiAgYXBwVHdpdHRlciA9IHJlcXVpcmUoJy4vY29tcG9uZW50cy90d2l0dGVyJykoYXBwR2xvYmFscyk7XG4vKipcbipDcmVhdGUgYmFzZSBWTVxuKi9cbnZhciB2bSA9IG5ldyBWdWUoe1xuICBlbDogJyNhcHAnLFxuICBkYXRhOiB7XG4gICAgY3VycmVudFBhZ2U6ICdhcHAtcHJvZmlsZSdcbiAgfSxcbiAgY29tcHV0ZWQ6IHt9LFxuICBtZXRob2RzOiB7fSxcbiAgZXZlbnRzOiB7XG4gICAgJ3NldHBhZ2UnOiBmdW5jdGlvbiAocGFnZSkge1xuICAgICAgaWYocGFnZSA9PSAncHJvZmlsZScpIHtcbiAgICAgICAgdGhpcy5jdXJyZW50UGFnZSA9ICdhcHAtcHJvZmlsZSc7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgICAgaWYocGFnZSA9PSAnbG9jYWwnKSB7XG4gICAgICAgIHRoaXMuY3VycmVudFBhZ2UgPSAnYXBwLWxvY2FsJztcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICBpZihwYWdlID09ICdmYWNlYm9vaycpIHtcbiAgICAgICAgdGhpcy5jdXJyZW50UGFnZSA9ICdhcHAtZmFjZWJvb2snO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICAgIGlmKHBhZ2UgPT0gJ3R3aXR0ZXInKSB7XG4gICAgICAgIHRoaXMuY3VycmVudFBhZ2UgPSAnYXBwLXR3aXR0ZXInO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIGNvbXBvbmVudHM6IHtcbiAgICAnYXBwLW5hdic6IGFwcE5hdixcbiAgICAnYXBwLXByb2ZpbGUnOiBhcHBQcm9maWxlLFxuICAgICdhcHAtbG9jYWwnOiBhcHBMb2NhbCxcbiAgICAnYXBwLWZhY2Vib29rJzogYXBwRmFjZWJvb2ssXG4gICAgJ2FwcC10d2l0dGVyJzogYXBwVHdpdHRlclxuICB9XG59KTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGFwcEdsb2JhbHMpIHtcbiAgcmV0dXJuIHtcbiAgICB0ZW1wbGF0ZTogcmVxdWlyZSgnLi90ZW1wbGF0ZS5odG1sJyksXG4gICAgZGF0YTogZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZGV0YWlsczoge1xuICAgICAgICAgIG5hbWU6IGFwcEdsb2JhbHMuZmFjZWJvb2submFtZSxcbiAgICAgICAgICBlbWFpbDogYXBwR2xvYmFscy5mYWNlYm9vay5lbWFpbFxuICAgICAgICB9LFxuICAgICAgICBwb3N0czogW10sXG4gICAgICAgIHNob3dMb2FkaW5nOiBmYWxzZVxuICAgICAgfTtcbiAgICB9LFxuICAgIGNvbXB1dGVkOiB7XG4gICAgICBzaG93UG9zdHM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYodGhpcy5wb3N0cy5sZW5ndGgpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9LFxuICAgICAgc2hvd0Jsb2NrOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmKHRoaXMuZGV0YWlscy5uYW1lLmxlbmd0aCkge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9LFxuICAgIG1ldGhvZHM6IHtcbiAgICAgIGdldFBvc3RzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuc2hvd0xvYWRpbmcgPSB0cnVlO1xuICAgICAgICB0aGlzLiRodHRwLmdldChhcHBHbG9iYWxzLmZiVVJMKVxuICAgICAgICAudGhlbihmdW5jdGlvbiAocmVzKSB7XG4gICAgICAgICAgdGhpcy5zaG93TG9hZGluZyA9IGZhbHNlO1xuICAgICAgICAgIHJlcy5kYXRhLmRhdGEuZm9yRWFjaChmdW5jdGlvbiAocG9zdCkge1xuICAgICAgICAgICAgdGhpcy5wb3N0cy5wdXNoKHBvc3QpO1xuICAgICAgICAgIH0uYmluZCh0aGlzKSlcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGZ1bmN0aW9uIChpbmZvLCBzdGF0dXMsIHJlcSkge1xuICAgICAgICAgIHRoaXMuc2hvd0xvYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgICB0aGlzLnBvc3RzLnB1c2goc3RhdHVzKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSAnPGRpdj5cXG4gIDxoMz5Qcm9maWxlIE5hbWU6IEZhY2Vib29rPC9oMz5cXG4gIDx0ZW1wbGF0ZSB2LWlmPVwic2hvd0Jsb2NrXCI+XFxuICAgIDxwPkRldGFpbHM8L3A+XFxuICAgIDx1bD5cXG4gICAgICA8bGkgdi1mb3I9XCJ2YWx1ZSBpbiBkZXRhaWxzXCI+e3ska2V5fX06IHt7e3ZhbHVlfX19PC9saT5cXG4gICAgPC91bD5cXG4gICAgPGRpdj5cXG4gICAgICA8YnV0dG9uIEBjbGljay5wcmV2ZW50LnN0b3A9XCJnZXRQb3N0c1wiXFxuICAgICAgY2xhc3M9XCJidG4gYnRuLXByaW1hcnkgYnRuLWxhcmdlXCI+R2V0IFJlY2VudCBQb3N0czwvYnV0dG9uPlxcbiAgICAgIDxzcGFuIHYtc2hvdz1cInNob3dMb2FkaW5nXCI+TG9hZGluZy4uLjwvc3Bhbj5cXG4gICAgICA8dWwgdi1zaG93PVwic2hvd1Bvc3RzXCIgY2xhc3M9XCJsaXN0LWdyb3VwXCI+XFxuICAgICAgICA8bGkgdi1mb3I9XCJpdGVtIGluIHBvc3RzXCIgY2xhc3M9XCJsaXN0LWdyb3VwLWl0ZW1cIj5cXG4gICAgICAgICAgPGRpdiBjbGFzcz1cIndlbGxcIj5cXG4gICAgICAgICAgICA8cCB2LXNob3c9XCJpdGVtLm1lc3NhZ2UubGVuZ3RoXCI+TWVzc2FnZToge3tpdGVtLm1lc3NhZ2V9fTwvcD5cXG4gICAgICAgICAgICA8cCB2LXNob3c9XCJpdGVtLnN0b3J5Lmxlbmd0aFwiPlN0b3J5OiB7e2l0ZW0uc3Rvcnl9fTwvcD5cXG4gICAgICAgICAgPC9kaXY+XFxuICAgICAgICA8L2xpPlxcbiAgICAgIDwvdWw+XFxuICAgIDwvZGl2PlxcbiAgPC90ZW1wbGF0ZT5cXG48L2Rpdj5cXG4nOyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGFwcEdsb2JhbHMpIHtcbiAgcmV0dXJuIHtcbiAgICB0ZW1wbGF0ZTogcmVxdWlyZSgnLi90ZW1wbGF0ZS5odG1sJyksXG4gICAgZGF0YTogZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZGV0YWlsczoge1xuICAgICAgICAgIHVzZXJuYW1lOiBhcHBHbG9iYWxzLmxvY2FsLnVzZXJuYW1lLFxuICAgICAgICAgIGVtYWlsOiBhcHBHbG9iYWxzLmxvY2FsLmVtYWlsXG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSxcbiAgICBjb21wdXRlZDoge1xuICAgICAgc2hvd0Jsb2NrOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmKHRoaXMuZGV0YWlscy51c2VybmFtZS5sZW5ndGgpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICB9O1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gJzxkaXY+XFxuICA8aDM+UHJvZmlsZSBOYW1lOiBMb2NhbDwvaDM+XFxuICA8dGVtcGxhdGUgdi1pZj1cInNob3dCbG9ja1wiPlxcbiAgICA8cD5EZXRhaWxzPC9wPlxcbiAgICA8dWw+XFxuICAgICAgPGxpIHYtZm9yPVwidmFsdWUgaW4gZGV0YWlsc1wiPnt7JGtleX19OiB7e3ZhbHVlfX08L2xpPlxcbiAgICA8L3VsPlxcbiAgPC90ZW1wbGF0ZT5cXG48L2Rpdj5cXG4nOyIsIm1vZHVsZS5leHBvcnRzID0ge1xuICB0ZW1wbGF0ZTogcmVxdWlyZSgnLi90ZW1wbGF0ZS5odG1sJyksXG4gIG1ldGhvZHM6IHtcbiAgICBjaGFuZ2VQYWdlOiBmdW5jdGlvbiAocGFnZSkge1xuICAgICAgdGhpcy4kZGlzcGF0Y2goJ3NldHBhZ2UnLCBwYWdlKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gJzx1bCBjbGFzcz1cIm5hdiBuYXZiYXItbmF2XCI+XFxuICA8bGk+PGEgaHJlZj1cIlwiIEBjbGljay5wcmV2ZW50LnN0b3A9XCJjaGFuZ2VQYWdlKFxcJ3Byb2ZpbGVcXCcpXCI+UHJvZmlsZTwvYT48L2xpPlxcbiAgPGxpPjxhIGhyZWY9XCJcIiBAY2xpY2sucHJldmVudC5zdG9wPVwiY2hhbmdlUGFnZShcXCdsb2NhbFxcJylcIj5Mb2NhbDwvYT48L2xpPlxcbiAgPGxpPjxhIGhyZWY9XCJcIiBAY2xpY2sucHJldmVudC5zdG9wPVwiY2hhbmdlUGFnZShcXCdmYWNlYm9va1xcJylcIj5GYWNlYm9vazwvYT48L2xpPlxcbiAgPGxpPjxhIGhyZWY9XCJcIiBAY2xpY2sucHJldmVudC5zdG9wPVwiY2hhbmdlUGFnZShcXCd0d2l0dGVyXFwnKVwiPlR3aXR0ZXI8L2E+PC9saT5cXG48L3VsPlxcbic7IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoYXBwR2xvYmFscykge1xuICByZXR1cm4ge1xuICAgIHRlbXBsYXRlOiByZXF1aXJlKCcuL3RlbXBsYXRlLmh0bWwnKSxcbiAgICBkYXRhOiBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBwZXJzb246IGFwcEdsb2JhbHMucGVyc29uLFxuICAgICAgICBjdXJyZW50UHJvZmlsZTogYXBwR2xvYmFscy5jdXJyZW50UHJvZmlsZSxcbiAgICAgICAgdXNlclBob3RvOiBhcHBHbG9iYWxzLnVzZXJQaG90byxcbiAgICAgICAgbG9jYWxMaW5rU3RhdHVzOiBhcHBHbG9iYWxzLmxpbmtTdGF0dXMubG9jYWwsXG4gICAgICAgIGZiTGlua1N0YXR1czogYXBwR2xvYmFscy5saW5rU3RhdHVzLmZiLFxuICAgICAgICB0d2l0dGVyTGlua1N0YXR1czogYXBwR2xvYmFscy5saW5rU3RhdHVzLnR3aXR0ZXIsXG4gICAgICAgIGhpZGVMaW5rQWNjdDogYXBwR2xvYmFscy5oaWRlTGlua0FjY3QsXG4gICAgICAgIGhpZGVMb2NhbExpbms6IGFwcEdsb2JhbHMuaGlkZUxvY2FsTGluayxcbiAgICAgICAgaGlkZUZCTGluazogYXBwR2xvYmFscy5oaWRlRkJMaW5rLFxuICAgICAgICBoaWRlVHdpdHRlckxpbms6IGFwcEdsb2JhbHMuaGlkZVR3aXR0ZXJMaW5rXG4gICAgICB9O1xuICAgIH1cbiAgfTtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9ICc8ZGl2PlxcbiAgPGZpZ3VyZSB2LXNob3c9XCJ1c2VyUGhvdG9cIj48aW1nIDpzcmM9XCJ1c2VyUGhvdG9cIiA6YWx0PVwicGVyc29uICsgXFwnIHBob3RvXFwnXCI+PC9maWd1cmU+XFxuICA8ZGl2PlxcbiAgICA8aDM+V2VsY29tZSBcXCd7e3twZXJzb259fX1cXCcsIHlvdXIgcHJlc2VudCBwcm9maWxlIGlzIFxcJ3t7Y3VycmVudFByb2ZpbGV9fVxcJzwvaDM+XFxuICA8L2Rpdj5cXG4gIDxkaXY+XFxuICAgIDxoMyB2LXNob3c9XCJoaWRlTGlua0FjY3RcIj5MaW5rIHlvdXIgb3RoZXIgYWNjb3VudHMgdG8geW91ciBwcm9maWxlPC9oMz5cXG4gICAgPHAgdi1zaG93PVwiaGlkZUxvY2FsTGlua1wiPjxhIGhyZWY9XCIvY29ubmVjdC9sb2NhbFwiPkxvY2FsOiBTdGF0dXMgKHt7bG9jYWxMaW5rU3RhdHVzfX0pPC9hPjwvcD5cXG4gICAgPHAgdi1zaG93PVwiaGlkZUZCTGlua1wiPjxhIGhyZWY9XCIvY29ubmVjdC9mYWNlYm9va1wiPkZhY2Vib29rOiBTdGF0dXMgKHt7ZmJMaW5rU3RhdHVzfX0pPC9hPjwvcD5cXG4gICAgPHAgdi1zaG93PVwiaGlkZVR3aXR0ZXJMaW5rXCI+PGEgaHJlZj1cIi9jb25uZWN0L3R3aXR0ZXJcIj5Ud2l0dGVyOiBTdGF0dXMgKHt7dHdpdHRlckxpbmtTdGF0dXN9fSk8L2E+PC9wPlxcbiAgPC9kaXY+XFxuPC9kaXY+XFxuJzsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChhcHBHbG9iYWxzKSB7XG4gIHJldHVybiB7XG4gICAgdGVtcGxhdGU6IHJlcXVpcmUoJy4vdGVtcGxhdGUuaHRtbCcpLFxuICAgIGRhdGE6IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGRldGFpbHM6IHtcbiAgICAgICAgICBoYW5kbGU6IGFwcEdsb2JhbHMudHdpdHRlci5oYW5kbGUsXG4gICAgICAgICAgbG9jYXRpb246IGFwcEdsb2JhbHMudHdpdHRlci5sb2NhdGlvbixcbiAgICAgICAgICBkZXNjcmlwdGlvbjogYXBwR2xvYmFscy50d2l0dGVyLmRlc2NyaXB0aW9uXG4gICAgICAgIH0sXG4gICAgICAgIHRpbWVsaW5lOiBbXSxcbiAgICAgICAgc2hvd0xvYWRpbmc6IGZhbHNlXG4gICAgICB9O1xuICAgIH0sXG4gICAgY29tcHV0ZWQ6IHtcbiAgICAgIHNob3dUaW1lTGluZTogZnVuY3Rpb24gKCkge1xuICAgICAgICBpZih0aGlzLnRpbWVsaW5lLmxlbmd0aCkge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgICBzaG93QmxvY2s6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYodGhpcy5kZXRhaWxzLmhhbmRsZS5sZW5ndGgpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfSxcbiAgICBtZXRob2RzOiB7XG4gICAgICBnZXRUd2VldHM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5zaG93TG9hZGluZyA9IHRydWU7XG4gICAgICAgIHRoaXMuJGh0dHAuZ2V0KGFwcEdsb2JhbHMudHdpdHRlclVSTClcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24gKHJlcykge1xuICAgICAgICAgIHRoaXMuc2hvd0xvYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgICByZXMuZGF0YS5tc2cuZm9yRWFjaChmdW5jdGlvbiAodHdlZXQpIHtcbiAgICAgICAgICAgIHRoaXMudGltZWxpbmUucHVzaCh0d2VldCk7XG4gICAgICAgICAgfS5iaW5kKHRoaXMpKVxuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goZnVuY3Rpb24gKGluZm8sIHN0YXR1cywgcmVxKSB7XG4gICAgICAgICAgdGhpcy5zaG93TG9hZGluZyA9IGZhbHNlO1xuICAgICAgICAgIHRoaXMucG9zdHMucHVzaChzdGF0dXMpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9ICc8ZGl2PlxcbiAgPGgzPlByb2ZpbGUgTmFtZTogVHdpdHRlcjwvaDM+XFxuICA8dGVtcGxhdGUgdi1pZj1cInNob3dCbG9ja1wiPlxcbiAgICA8cD5EZXRhaWxzPC9wPlxcbiAgICA8dWw+XFxuICAgICAgPGxpIHYtZm9yPVwidmFsdWUgaW4gZGV0YWlsc1wiPnt7JGtleX19OiB7e3ZhbHVlfX08L2xpPlxcbiAgICA8L3VsPlxcbiAgICA8ZGl2PlxcbiAgICAgIDxidXR0b24gQGNsaWNrLnByZXZlbnQuc3RvcD1cImdldFR3ZWV0c1wiXFxuICAgICAgY2xhc3M9XCJidG4gYnRuLXByaW1hcnkgYnRuLWxhcmdlXCI+R2V0IFJlY2VudCB0aW1lbGluZSBhY3Rpdml0eTwvYnV0dG9uPlxcbiAgICAgIDxzcGFuIHYtc2hvdz1cInNob3dMb2FkaW5nXCI+TG9hZGluZy4uLjwvc3Bhbj5cXG4gICAgICA8dWwgdi1zaG93PVwic2hvd1RpbWVMaW5lXCIgY2xhc3M9XCJsaXN0LWdyb3VwXCI+XFxuICAgICAgICA8bGkgdi1mb3I9XCJpdGVtIGluIHRpbWVsaW5lXCIgY2xhc3M9XCJsaXN0LWdyb3VwLWl0ZW1cIj5cXG4gICAgICAgICAgPGRpdiBjbGFzcz1cIndlbGxcIj5cXG4gICAgICAgICAgICA8ZmlndXJlPjxpbWcgOnNyYz1cIml0ZW0ucGhvdG9cIiBhbHQ9XCJ7e2l0ZW0uc2VuZGVyfX0gcGhvdG9cIiAvPjwvZmlndXJlPlxcbiAgICAgICAgICAgIDxwPlNlbmRlcjoge3tpdGVtLnNlbmRlcn19PC9wPlxcbiAgICAgICAgICAgIDxwPkxvY2F0aW9uOiB7e2l0ZW0ubG9jYXRpb259fTwvcD5cXG4gICAgICAgICAgICA8cD5Ud2VldDoge3tpdGVtLnRleHR9fTwvcD5cXG4gICAgICAgICAgPC9kaXY+XFxuICAgICAgICA8L2xpPlxcbiAgICAgIDwvdWw+XFxuICAgIDwvZGl2PlxcbiAgPC90ZW1wbGF0ZT5cXG48L2Rpdj5cXG4nOyJdfQ==
