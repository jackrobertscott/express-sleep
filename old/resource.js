const mongoose = require('mongoose');
const { Router } = require('express');
const { camelCase, lowerCase } = require('change-case');
const { plural, singular } = require('pluralize');
const Route = require('./route');
const {
  checkString,
  checkCompile,
  middlify,
  hookify,
  permissionify,
  orderRoutes,
} = require('./utils/helpers');
const {
  find,
  count,
  findOne,
  findById,
  create,
  update,
  remove,
} = require('./utils/controller');

class Resource {

  /**
   * Format an endpoint to make sure it matches correct standards.
   */
  static formatEndpoint([id, { path, method, handler, open = false } = {}]) {
    checkString(id, { message: 'Expected "id" parameter to be a string.' });
    checkString(path, { message: 'Expected "path" parameter to be a string.' });
    checkString(method, { message: 'Expected "method" parameter to be a string.' });
    if (typeof handler !== 'function' && typeof handler.then !== 'function') {
      throw new Error('Expected "handler" parameter to be a function.');
    }
    if (typeof open !== 'boolean') {
      throw new Error('Expected "public" parameter to be a boolean.');
    }
    return [id, {
      path,
      method: lowerCase(method),
      handler,
      open,
    }];
  }

  /**
   * Create the RESTful resource.
   *
   * @param {string} resourceName name of the resource
   * @param {object} schema mongoose schema
   * @param {object} options options for the resource
   * @param {array} options.disable routes to disable
   */
  constructor({
    name,
    schema,
    address,
    disable = [],
    unsecure = false,
    timestamps = true,
    safe = true,
  } = {}) {
    if (typeof name !== 'string') {
      throw new Error('Parameter "name" must be given to the Resource constructor as a string.');
    }
    if (typeof schema !== 'object') {
      throw new Error('Parameter "schema" must be given to the Resource constructor as a mongoose schema.');
    }
    if (!Array.isArray(disable)) {
      throw new Error('Parameter "disable" must be given to the Resource constructor as an array.');
    }
    if (address && typeof address !== 'string') {
      throw new Error('Parameter "address" must be given to the Resource constructor as a string.');
    }
    this.setup = false;
    this.unsecure = unsecure;
    this.resourceName = camelCase(singular(name));
    this.address = address || `/${camelCase(plural(name))}`;
    this.name = name;
    this.schema = schema;
    this.options = { timestamps, safe };
    this.disable = new Set(disable);
    const endpoints = [...this.defaults.entries()]
      .map(Resource.formatEndpoint)
      .filter(endpoint => !this.disable.has(endpoint[0]));
    this.endpoints = new Map(endpoints);
    this.middleware = new Map();
    this.preHooks = new Map();
    this.postHooks = new Map();
    this.permissions = new Map();
    if (safe) {
      this.schema.add({
        deleted: {
          type: Boolean,
          required: true,
          default: false,
        },
      });
      if (timestamps) {
        this.schema.add({
          deletedAt: {
            type: Date,
          },
        });
      }
    }
    if (timestamps) {
      this.schema.set('timestamps', true);
    }
  }

  /**
   * Setup some default CRUD functions to use for the resource.
   */
  get defaults() {
    const routes = new Map();
    routes
      .set('find', {
        path: '/',
        method: 'get',
        handler: find(this.resourceName, this.options),
      })
      .set('count', {
        path: '/count',
        method: 'get',
        handler: count(this.resourceName, this.options),
      })
      .set('findOne', {
        path: '/one',
        method: 'get',
        handler: findOne(this.resourceName, this.options),
      })
      .set('findById', {
        path: `/:${this.resourceName}Id`,
        method: 'get',
        handler: findById(this.resourceName, this.options),
      })
      .set('create', {
        path: '/',
        method: 'post',
        handler: create(this.resourceName, this.options),
      })
      .set('update', {
        path: `/:${this.resourceName}Id`,
        method: 'patch',
        handler: update(this.resourceName, this.options),
      })
      .set('remove', {
        path: `/:${this.resourceName}Id`,
        method: 'delete',
        handler: remove(this.resourceName, this.options),
      });
    return routes;
  }

  /**
   * Get the model after it has been defined.
   */
  get model() {
    try {
      return mongoose.model(this.name);
    } catch (e) {
      return mongoose.model(this.name, this.schema);
    }
  }

  /**
   * Create a route for easy use of resource.
   *
   * @param {string} id the id of the endpoint
   */
  route(id) {
    return new Route({ id, resource: this });
  }

  /**
   * Add activation middleware to an endpoint.
   *
   * @param {string} id the id of the endpoint
   * @param {object} endpoint the endpoint data
   * @param {string} endpoint.path route path of the endpoint
   * @param {string} endpoint.method the type of HTTP request
   * @param {function} endpoint.handler function which handles an enpoint request
   */
  addEndpoint(id, endpoint) {
    checkCompile(this.setup);
    checkString(id, { message: `Endpoint id ${id} was not passed in as a string.` });
    if (typeof endpoint !== 'object') {
      throw new Error(`Endpoint data for ${id} must be an object.`);
    }
    const submission = Resource.formatEndpoint([id, endpoint]);
    this.endpoints.set(...submission);
    return this;
  }

  /**
   * Add activation middleware to an endpoint.
   *
   * @param {string} id the id of the endpoint to apply the middleware
   * @param {function} middleware the middleware function
   */
  addMiddleware(id, middleware) {
    checkCompile(this.setup);
    checkString(id, { method: 'addMiddleware' });
    if (typeof middleware !== 'function' && typeof middleware.then !== 'function') {
      throw new Error(`Function not passed as "hook" parameter in addPreHook for "${id}".`);
    }
    let tasks = [];
    if (this.middleware.has(id)) {
      tasks = this.middleware.get(id);
    }
    this.middleware.set(id, [...tasks, middleware]);
    return this;
  }

  /**
   * Add a hook to an endpoint function.
   *
   * @param {string} id the id of the endpoint
   * @param {function} hook a function to run
   */
  addPreHook(id, hook) {
    checkCompile(this.setup);
    checkString(id, { method: 'addPreHook' });
    if (typeof hook !== 'function' && typeof hook.then !== 'function') {
      throw new Error(`Function not passed as "hook" parameter in addPreHook for "${id}".`);
    }
    let hooks = [];
    if (this.preHooks.has(id)) {
      hooks = this.preHooks.get(id);
    }
    this.preHooks.set(id, [...hooks, hook]);
    return this;
  }

  /**
   * Add a hook to an endpoint function.
   *
   * @param {string} id the id of the endpoint
   * @param {function} hook a function to run
   */
  addPostHook(id, hook) {
    checkCompile(this.setup);
    checkString(id, { method: 'addPostHook' });
    if (typeof hook !== 'function' && typeof hook.then !== 'function') {
      throw new Error(`Function not passed as "hook" parameter in addPostHook for "${id}".`);
    }
    let hooks = [];
    if (this.postHooks.has(id)) {
      hooks = this.postHooks.get(id);
    }
    this.postHooks.set(id, [...hooks, hook]);
    return this;
  }

  /**
   * Add a permission function to allow access to an endpoint.
   *
   * @param {string} id the id of the endpoint
   * @param {function} permission a function to run and should return a truth
   */
  addPermission(id, permission) {
    checkCompile(this.setup);
    checkString(id, { method: 'addPermission' });
    if (typeof permission !== 'function' && typeof permission.then !== 'function') {
      throw new Error(`Function not passed as "permission" parameter in addPermission for "${id}".`);
    }
    let permissions = [];
    if (this.permissions.has(id)) {
      permissions = this.permissions.get(id);
    }
    this.permissions.set(id, [...permissions, permission]);
    return this;
  }

  /**
   * Compile the resource and set it in stone.
   */
  compile() {
    if (this.setup) {
      throw new Error('Resource has already been setup. Calling Resource.compile() more than once.');
    }
    this.setup = true;
    this.router = Router();
    [...this.endpoints.entries()]
      .sort(orderRoutes)
      .forEach(([key, { path, method, handler, open }]) => {
        const unsecure = typeof open === 'boolean' ? open : this.unsecure;
        const resources = {
          Model: this.model,
          context: {}, // empty object which can be used to pass information between middlewares
        };
        const middleware = this.middleware.has(key) ? this.middleware.get(key) : [];
        const permission = middlify(permissionify(key, this.permissions, unsecure), resources);
        const hooked = hookify(key, handler, this.preHooks, this.postHooks);
        const work = middlify(hooked, resources, true);
        this.router[lowerCase(method)](path, ...middleware, permission, work);
      });
    return this;
  }

  /**
   * Attach this resource's routes to the application.
   *
   * @param {object} app the express application instance
   */
  attach(app) {
    if (!app) {
      throw new Error('Parameter "app" must be given provided as an express app instance.');
    }
    if (!this.setup) {
      this.compile();
    }
    app.use(this.address, this.router);
  }

}
module.exports = Resource;