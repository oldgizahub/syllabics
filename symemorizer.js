var pas = {};

var rtl = {

  version: 20004,

  quiet: false,
  debug_load_units: false,
  debug_rtti: false,

  $res : {},

  debug: function(){
    if (rtl.quiet || !console || !console.log) return;
    console.log(arguments);
  },

  error: function(s){
    rtl.debug('Error: ',s);
    throw s;
  },

  warn: function(s){
    rtl.debug('Warn: ',s);
  },

  checkVersion: function(v){
    if (rtl.version != v) throw "expected rtl version "+v+", but found "+rtl.version;
  },

  hiInt: Math.pow(2,53),

  hasString: function(s){
    return rtl.isString(s) && (s.length>0);
  },

  isArray: function(a) {
    return Array.isArray(a);
  },

  isFunction: function(f){
    return typeof(f)==="function";
  },

  isModule: function(m){
    return rtl.isObject(m) && rtl.hasString(m.$name) && (pas[m.$name]===m);
  },

  isImplementation: function(m){
    return rtl.isObject(m) && rtl.isModule(m.$module) && (m.$module.$impl===m);
  },

  isNumber: function(n){
    return typeof(n)==="number";
  },

  isObject: function(o){
    var s=typeof(o);
    return (typeof(o)==="object") && (o!=null);
  },

  isString: function(s){
    return typeof(s)==="string";
  },

  getNumber: function(n){
    return typeof(n)==="number"?n:NaN;
  },

  getChar: function(c){
    return ((typeof(c)==="string") && (c.length===1)) ? c : "";
  },

  getObject: function(o){
    return ((typeof(o)==="object") || (typeof(o)==='function')) ? o : null;
  },

  isTRecord: function(type){
    return (rtl.isObject(type) && type.hasOwnProperty('$new') && (typeof(type.$new)==='function'));
  },

  isPasClass: function(type){
    return (rtl.isObject(type) && type.hasOwnProperty('$classname') && rtl.isObject(type.$module));
  },

  isPasClassInstance: function(type){
    return (rtl.isObject(type) && rtl.isPasClass(type.$class));
  },

  hexStr: function(n,digits){
    return ("000000000000000"+n.toString(16).toUpperCase()).slice(-digits);
  },

  m_loading: 0,
  m_loading_intf: 1,
  m_intf_loaded: 2,
  m_loading_impl: 3, // loading all used unit
  m_initializing: 4, // running initialization
  m_initialized: 5,

  module: function(module_name, intfuseslist, intfcode, impluseslist){
    if (rtl.debug_load_units) rtl.debug('rtl.module name="'+module_name+'" intfuses='+intfuseslist+' impluses='+impluseslist);
    if (!rtl.hasString(module_name)) rtl.error('invalid module name "'+module_name+'"');
    if (!rtl.isArray(intfuseslist)) rtl.error('invalid interface useslist of "'+module_name+'"');
    if (!rtl.isFunction(intfcode)) rtl.error('invalid interface code of "'+module_name+'"');
    if (!(impluseslist==undefined) && !rtl.isArray(impluseslist)) rtl.error('invalid implementation useslist of "'+module_name+'"');

    if (pas[module_name])
      rtl.error('module "'+module_name+'" is already registered');

    var r = Object.create(rtl.tSectionRTTI);
    var module = r.$module = pas[module_name] = {
      $name: module_name,
      $intfuseslist: intfuseslist,
      $impluseslist: impluseslist,
      $state: rtl.m_loading,
      $intfcode: intfcode,
      $implcode: null,
      $impl: null,
      $rtti: r
    };
    if (impluseslist) module.$impl = {
          $module: module,
          $rtti: r
        };
  },

  exitcode: 0,

  run: function(module_name){
    try {
      if (!rtl.hasString(module_name)) module_name='program';
      if (rtl.debug_load_units) rtl.debug('rtl.run module="'+module_name+'"');
      rtl.initRTTI();
      var module = pas[module_name];
      if (!module) rtl.error('rtl.run module "'+module_name+'" missing');
      rtl.loadintf(module);
      rtl.loadimpl(module);
      if (module_name=='program'){
        if (rtl.debug_load_units) rtl.debug('running $main');
        var r = pas.program.$main();
        if (rtl.isNumber(r)) rtl.exitcode = r;
      }
    } catch(re) {
      if (!rtl.showUncaughtExceptions) {
        throw re
      } else {  
        if (!rtl.handleUncaughtException(re)) {
          rtl.showException(re);
          rtl.exitcode = 216;
        }  
      }
    } 
    return rtl.exitcode;
  },
  
  showException : function (re) {
    var errMsg = rtl.hasString(re.$classname) ? re.$classname : '';
    errMsg +=  ((errMsg) ? ': ' : '') + (re.hasOwnProperty('fMessage') ? re.fMessage : re);
    alert('Uncaught Exception : '+errMsg);
  },

  handleUncaughtException: function (e) {
    if (rtl.onUncaughtException) {
      try {
        rtl.onUncaughtException(e);
        return true;
      } catch (ee) {
        return false; 
      }
    } else {
      return false;
    }
  },

  loadintf: function(module){
    if (module.$state>rtl.m_loading_intf) return; // already finished
    if (rtl.debug_load_units) rtl.debug('loadintf: "'+module.$name+'"');
    if (module.$state===rtl.m_loading_intf)
      rtl.error('unit cycle detected "'+module.$name+'"');
    module.$state=rtl.m_loading_intf;
    // load interfaces of interface useslist
    rtl.loaduseslist(module,module.$intfuseslist,rtl.loadintf);
    // run interface
    if (rtl.debug_load_units) rtl.debug('loadintf: run intf of "'+module.$name+'"');
    module.$intfcode(module.$intfuseslist);
    // success
    module.$state=rtl.m_intf_loaded;
    // Note: units only used in implementations are not yet loaded (not even their interfaces)
  },

  loaduseslist: function(module,useslist,f){
    if (useslist==undefined) return;
    var len = useslist.length;
    for (var i = 0; i<len; i++) {
      var unitname=useslist[i];
      if (rtl.debug_load_units) rtl.debug('loaduseslist of "'+module.$name+'" uses="'+unitname+'"');
      if (pas[unitname]==undefined)
        rtl.error('module "'+module.$name+'" misses "'+unitname+'"');
      f(pas[unitname]);
    }
  },

  loadimpl: function(module){
    if (module.$state>=rtl.m_loading_impl) return; // already processing
    if (module.$state<rtl.m_intf_loaded) rtl.error('loadimpl: interface not loaded of "'+module.$name+'"');
    if (rtl.debug_load_units) rtl.debug('loadimpl: load uses of "'+module.$name+'"');
    module.$state=rtl.m_loading_impl;
    // load interfaces of implementation useslist
    rtl.loaduseslist(module,module.$impluseslist,rtl.loadintf);
    // load implementation of interfaces useslist
    rtl.loaduseslist(module,module.$intfuseslist,rtl.loadimpl);
    // load implementation of implementation useslist
    rtl.loaduseslist(module,module.$impluseslist,rtl.loadimpl);
    // Note: At this point all interfaces used by this unit are loaded. If
    //   there are implementation uses cycles some used units might not yet be
    //   initialized. This is by design.
    // run implementation
    if (rtl.debug_load_units) rtl.debug('loadimpl: run impl of "'+module.$name+'"');
    if (rtl.isFunction(module.$implcode)) module.$implcode(module.$impluseslist);
    // run initialization
    if (rtl.debug_load_units) rtl.debug('loadimpl: run init of "'+module.$name+'"');
    module.$state=rtl.m_initializing;
    if (rtl.isFunction(module.$init)) module.$init();
    // unit initialized
    module.$state=rtl.m_initialized;
  },

  createCallback: function(scope, fn){
    var cb;
    if (typeof(fn)==='string'){
      cb = function(){
        return scope[fn].apply(scope,arguments);
      };
    } else {
      cb = function(){
        return fn.apply(scope,arguments);
      };
    };
    cb.scope = scope;
    cb.fn = fn;
    return cb;
  },

  createSafeCallback: function(scope, fn){
    var cb = function(){
      try{
        if (typeof(fn)==='string'){
          return scope[fn].apply(scope,arguments);
        } else {
          return fn.apply(scope,arguments);
        };
      } catch (err) {
        if (!rtl.handleUncaughtException(err)) throw err;
      }
    };
    cb.scope = scope;
    cb.fn = fn;
    return cb;
  },

  cloneCallback: function(cb){
    return rtl.createCallback(cb.scope,cb.fn);
  },

  eqCallback: function(a,b){
    // can be a function or a function wrapper
    if (a==b){
      return true;
    } else {
      return (a!=null) && (b!=null) && (a.fn) && (a.scope===b.scope) && (a.fn==b.fn);
    }
  },

  initStruct: function(c,parent,name){
    if ((parent.$module) && (parent.$module.$impl===parent)) parent=parent.$module;
    c.$parent = parent;
    if (rtl.isModule(parent)){
      c.$module = parent;
      c.$name = name;
    } else {
      c.$module = parent.$module;
      c.$name = parent.$name+'.'+name;
    };
    return parent;
  },

  initClass: function(c,parent,name,initfn,rttiname){
    parent[name] = c;
    c.$class = c; // Note: o.$class === Object.getPrototypeOf(o)
    c.$classname = rttiname?rttiname:name;
    parent = rtl.initStruct(c,parent,name);
    c.$fullname = parent.$name+'.'+name;
    // rtti
    if (rtl.debug_rtti) rtl.debug('initClass '+c.$fullname);
    var t = c.$module.$rtti.$Class(c.$classname,{ "class": c });
    c.$rtti = t;
    if (rtl.isObject(c.$ancestor)) t.ancestor = c.$ancestor.$rtti;
    if (!t.ancestor) t.ancestor = null;
    // init members
    initfn.call(c);
  },

  createClass: function(parent,name,ancestor,initfn,rttiname){
    // create a normal class,
    // ancestor must be null or a normal class,
    // the root ancestor can be an external class
    var c = null;
    if (ancestor != null){
      c = Object.create(ancestor);
      c.$ancestor = ancestor;
      // Note:
      // if root is an "object" then c.$ancestor === Object.getPrototypeOf(c)
      // if root is a "function" then c.$ancestor === c.__proto__, Object.getPrototypeOf(c) returns the root
    } else {
      c = { $ancestor: null };
      c.$create = function(fn,args){
        if (args == undefined) args = [];
        var o = Object.create(this);
        o.$init();
        try{
          if (typeof(fn)==="string"){
            o[fn].apply(o,args);
          } else {
            fn.apply(o,args);
          };
          o.AfterConstruction();
        } catch($e){
          // do not call BeforeDestruction
          if (o.Destroy) o.Destroy();
          o.$final();
          throw $e;
        }
        return o;
      };
      c.$destroy = function(fnname){
        this.BeforeDestruction();
        if (this[fnname]) this[fnname]();
        this.$final();
      };
    };
    rtl.initClass(c,parent,name,initfn,rttiname);
  },

  createClassExt: function(parent,name,ancestor,newinstancefnname,initfn,rttiname){
    // Create a class using an external ancestor.
    // If newinstancefnname is given, use that function to create the new object.
    // If exist call BeforeDestruction and AfterConstruction.
    var isFunc = rtl.isFunction(ancestor);
    var c = null;
    if (isFunc){
      // create pascal class descendent from JS function
      c = Object.create(ancestor.prototype);
      c.$ancestorfunc = ancestor;
      c.$ancestor = null; // no pascal ancestor
    } else if (ancestor.$func){
      // create pascal class descendent from a pascal class descendent of a JS function
      isFunc = true;
      c = Object.create(ancestor);
      c.$ancestor = ancestor;
    } else {
      c = Object.create(ancestor);
      c.$ancestor = null; // no pascal ancestor
    }
    c.$create = function(fn,args){
      if (args == undefined) args = [];
      var o = null;
      if (newinstancefnname.length>0){
        o = this[newinstancefnname](fn,args);
      } else if(isFunc) {
        o = new this.$func(args);
      } else {
        o = Object.create(c);
      }
      if (o.$init) o.$init();
      try{
        if (typeof(fn)==="string"){
          this[fn].apply(o,args);
        } else {
          fn.apply(o,args);
        };
        if (o.AfterConstruction) o.AfterConstruction();
      } catch($e){
        // do not call BeforeDestruction
        if (o.Destroy) o.Destroy();
        if (o.$final) o.$final();
        throw $e;
      }
      return o;
    };
    c.$destroy = function(fnname){
      if (this.BeforeDestruction) this.BeforeDestruction();
      if (this[fnname]) this[fnname]();
      if (this.$final) this.$final();
    };
    rtl.initClass(c,parent,name,initfn,rttiname);
    if (isFunc){
      function f(){}
      f.prototype = c;
      c.$func = f;
    }
  },

  createHelper: function(parent,name,ancestor,initfn,rttiname){
    // create a helper,
    // ancestor must be null or a helper,
    var c = null;
    if (ancestor != null){
      c = Object.create(ancestor);
      c.$ancestor = ancestor;
      // c.$ancestor === Object.getPrototypeOf(c)
    } else {
      c = { $ancestor: null };
    };
    parent[name] = c;
    c.$class = c; // Note: o.$class === Object.getPrototypeOf(o)
    c.$classname = rttiname?rttiname:name;
    parent = rtl.initStruct(c,parent,name);
    c.$fullname = parent.$name+'.'+name;
    // rtti
    var t = c.$module.$rtti.$Helper(c.$classname,{ "helper": c });
    c.$rtti = t;
    if (rtl.isObject(ancestor)) t.ancestor = ancestor.$rtti;
    if (!t.ancestor) t.ancestor = null;
    // init members
    initfn.call(c);
  },

  tObjectDestroy: "Destroy",

  free: function(obj,name){
    if (obj[name]==null) return null;
    obj[name].$destroy(rtl.tObjectDestroy);
    obj[name]=null;
  },

  freeLoc: function(obj){
    if (obj==null) return null;
    obj.$destroy(rtl.tObjectDestroy);
    return null;
  },

  hideProp: function(o,p,v){
    Object.defineProperty(o,p, {
      enumerable: false,
      configurable: true,
      writable: true
    });
    if(arguments.length>2){ o[p]=v; }
  },

  recNewT: function(parent,name,initfn,full){
    // create new record type
    var t = {};
    if (parent) parent[name] = t;
    var h = rtl.hideProp;
    if (full){
      rtl.initStruct(t,parent,name);
      t.$record = t;
      h(t,'$record');
      h(t,'$name');
      h(t,'$parent');
      h(t,'$module');
      h(t,'$initSpec');
    }
    initfn.call(t);
    if (!t.$new){
      t.$new = function(){ return Object.create(t); };
    }
    t.$clone = function(r){ return t.$new().$assign(r); };
    h(t,'$new');
    h(t,'$clone');
    h(t,'$eq');
    h(t,'$assign');
    return t;
  },

  is: function(instance,type){
    return type.isPrototypeOf(instance) || (instance===type);
  },

  isExt: function(instance,type,mode){
    // mode===1 means instance must be a Pascal class instance
    // mode===2 means instance must be a Pascal class
    // Notes:
    // isPrototypeOf and instanceof return false on equal
    // isPrototypeOf does not work for Date.isPrototypeOf(new Date())
    //   so if isPrototypeOf is false test with instanceof
    // instanceof needs a function on right side
    if (instance == null) return false; // Note: ==null checks for undefined too
    if ((typeof(type) !== 'object') && (typeof(type) !== 'function')) return false;
    if (instance === type){
      if (mode===1) return false;
      if (mode===2) return rtl.isPasClass(instance);
      return true;
    }
    if (type.isPrototypeOf && type.isPrototypeOf(instance)){
      if (mode===1) return rtl.isPasClassInstance(instance);
      if (mode===2) return rtl.isPasClass(instance);
      return true;
    }
    if ((typeof type == 'function') && (instance instanceof type)) return true;
    return false;
  },

  Exception: null,
  EInvalidCast: null,
  EAbstractError: null,
  ERangeError: null,
  EIntOverflow: null,
  EPropWriteOnly: null,

  raiseE: function(typename){
    var t = rtl[typename];
    if (t==null){
      var mod = pas.SysUtils;
      if (!mod) mod = pas.sysutils;
      if (mod){
        t = mod[typename];
        if (!t) t = mod[typename.toLowerCase()];
        if (!t) t = mod['Exception'];
        if (!t) t = mod['exception'];
      }
    }
    if (t){
      if (t.Create){
        throw t.$create("Create");
      } else if (t.create){
        throw t.$create("create");
      }
    }
    if (typename === "EInvalidCast") throw "invalid type cast";
    if (typename === "EAbstractError") throw "Abstract method called";
    if (typename === "ERangeError") throw "range error";
    throw typename;
  },

  as: function(instance,type){
    if((instance === null) || rtl.is(instance,type)) return instance;
    rtl.raiseE("EInvalidCast");
  },

  asExt: function(instance,type,mode){
    if((instance === null) || rtl.isExt(instance,type,mode)) return instance;
    rtl.raiseE("EInvalidCast");
  },

  createInterface: function(module, name, guid, fnnames, ancestor, initfn){
    //console.log('createInterface name="'+name+'" guid="'+guid+'" names='+fnnames);
    var i = ancestor?Object.create(ancestor):{};
    module[name] = i;
    i.$module = module;
    i.$name = name;
    i.$fullname = module.$name+'.'+name;
    i.$guid = guid;
    i.$guidr = null;
    i.$names = fnnames?fnnames:[];
    if (rtl.isFunction(initfn)){
      // rtti
      if (rtl.debug_rtti) rtl.debug('createInterface '+i.$fullname);
      var t = i.$module.$rtti.$Interface(name,{ "interface": i, module: module });
      i.$rtti = t;
      if (ancestor) t.ancestor = ancestor.$rtti;
      if (!t.ancestor) t.ancestor = null;
      initfn.call(i);
    }
    return i;
  },

  strToGUIDR: function(s,g){
    var p = 0;
    function n(l){
      var h = s.substr(p,l);
      p+=l;
      return parseInt(h,16);
    }
    p+=1; // skip {
    g.D1 = n(8);
    p+=1; // skip -
    g.D2 = n(4);
    p+=1; // skip -
    g.D3 = n(4);
    p+=1; // skip -
    if (!g.D4) g.D4=[];
    g.D4[0] = n(2);
    g.D4[1] = n(2);
    p+=1; // skip -
    for(var i=2; i<8; i++) g.D4[i] = n(2);
    return g;
  },

  guidrToStr: function(g){
    if (g.$intf) return g.$intf.$guid;
    var h = rtl.hexStr;
    var s='{'+h(g.D1,8)+'-'+h(g.D2,4)+'-'+h(g.D3,4)+'-'+h(g.D4[0],2)+h(g.D4[1],2)+'-';
    for (var i=2; i<8; i++) s+=h(g.D4[i],2);
    s+='}';
    return s;
  },

  createTGUID: function(guid){
    var TGuid = (pas.System)?pas.System.TGuid:pas.system.tguid;
    var g = rtl.strToGUIDR(guid,TGuid.$new());
    return g;
  },

  getIntfGUIDR: function(intfTypeOrVar){
    if (!intfTypeOrVar) return null;
    if (!intfTypeOrVar.$guidr){
      var g = rtl.createTGUID(intfTypeOrVar.$guid);
      if (!intfTypeOrVar.hasOwnProperty('$guid')) intfTypeOrVar = Object.getPrototypeOf(intfTypeOrVar);
      g.$intf = intfTypeOrVar;
      intfTypeOrVar.$guidr = g;
    }
    return intfTypeOrVar.$guidr;
  },

  addIntf: function (aclass, intf, map){
    function jmp(fn){
      if (typeof(fn)==="function"){
        return function(){ return fn.apply(this.$o,arguments); };
      } else {
        return function(){ rtl.raiseE('EAbstractError'); };
      }
    }
    if(!map) map = {};
    var t = intf;
    var item = Object.create(t);
    if (!aclass.hasOwnProperty('$intfmaps')) aclass.$intfmaps = {};
    aclass.$intfmaps[intf.$guid] = item;
    do{
      var names = t.$names;
      if (!names) break;
      for (var i=0; i<names.length; i++){
        var intfname = names[i];
        var fnname = map[intfname];
        if (!fnname) fnname = intfname;
        //console.log('addIntf: intftype='+t.$name+' index='+i+' intfname="'+intfname+'" fnname="'+fnname+'" old='+typeof(item[intfname]));
        item[intfname] = jmp(aclass[fnname]);
      }
      t = Object.getPrototypeOf(t);
    }while(t!=null);
  },

  getIntfG: function (obj, guid, query){
    if (!obj) return null;
    //console.log('getIntfG: obj='+obj.$classname+' guid='+guid+' query='+query);
    // search
    var maps = obj.$intfmaps;
    if (!maps) return null;
    var item = maps[guid];
    if (!item) return null;
    // check delegation
    //console.log('getIntfG: obj='+obj.$classname+' guid='+guid+' query='+query+' item='+typeof(item));
    if (typeof item === 'function') return item.call(obj); // delegate. Note: COM contains _AddRef
    // check cache
    var intf = null;
    if (obj.$interfaces){
      intf = obj.$interfaces[guid];
      //console.log('getIntfG: obj='+obj.$classname+' guid='+guid+' cache='+typeof(intf));
    }
    if (!intf){ // intf can be undefined!
      intf = Object.create(item);
      intf.$o = obj;
      if (!obj.$interfaces) obj.$interfaces = {};
      obj.$interfaces[guid] = intf;
    }
    if (typeof(query)==='object'){
      // called by queryIntfT
      var o = null;
      if (intf.QueryInterface(rtl.getIntfGUIDR(query),
          {get:function(){ return o; }, set:function(v){ o=v; }}) === 0){
        return o;
      } else {
        return null;
      }
    } else if(query===2){
      // called by TObject.GetInterfaceByStr
      if (intf.$kind === 'com') intf._AddRef();
    }
    return intf;
  },

  getIntfT: function(obj,intftype){
    return rtl.getIntfG(obj,intftype.$guid);
  },

  queryIntfT: function(obj,intftype){
    return rtl.getIntfG(obj,intftype.$guid,intftype);
  },

  queryIntfIsT: function(obj,intftype){
    var i = rtl.getIntfG(obj,intftype.$guid);
    if (!i) return false;
    if (i.$kind === 'com') i._Release();
    return true;
  },

  asIntfT: function (obj,intftype){
    var i = rtl.getIntfG(obj,intftype.$guid);
    if (i!==null) return i;
    rtl.raiseEInvalidCast();
  },

  intfIsIntfT: function(intf,intftype){
    return (intf!==null) && rtl.queryIntfIsT(intf.$o,intftype);
  },

  intfAsIntfT: function (intf,intftype){
    if (!intf) return null;
    var i = rtl.getIntfG(intf.$o,intftype.$guid);
    if (i) return i;
    rtl.raiseEInvalidCast();
  },

  intfIsClass: function(intf,classtype){
    return (intf!=null) && (rtl.is(intf.$o,classtype));
  },

  intfAsClass: function(intf,classtype){
    if (intf==null) return null;
    return rtl.as(intf.$o,classtype);
  },

  intfToClass: function(intf,classtype){
    if ((intf!==null) && rtl.is(intf.$o,classtype)) return intf.$o;
    return null;
  },

  // interface reference counting
  intfRefs: { // base object for temporary interface variables
    ref: function(id,intf){
      // called for temporary interface references needing delayed release
      var old = this[id];
      //console.log('rtl.intfRefs.ref: id='+id+' old="'+(old?old.$name:'null')+'" intf="'+(intf?intf.$name:'null')+' $o='+(intf?intf.$o:'null'));
      if (old){
        // called again, e.g. in a loop
        delete this[id];
        old._Release(); // may fail
      }
      if(intf) {
        this[id]=intf;
      }
      return intf;
    },
    free: function(){
      //console.log('rtl.intfRefs.free...');
      for (var id in this){
        if (this.hasOwnProperty(id)){
          var intf = this[id];
          if (intf){
            //console.log('rtl.intfRefs.free: id='+id+' '+intf.$name+' $o='+intf.$o.$classname);
            intf._Release();
          }
        }
      }
    }
  },

  createIntfRefs: function(){
    //console.log('rtl.createIntfRefs');
    return Object.create(rtl.intfRefs);
  },

  setIntfP: function(path,name,value,skipAddRef){
    var old = path[name];
    //console.log('rtl.setIntfP path='+path+' name='+name+' old="'+(old?old.$name:'null')+'" value="'+(value?value.$name:'null')+'"');
    if (old === value) return;
    if (old !== null){
      path[name]=null;
      old._Release();
    }
    if (value !== null){
      if (!skipAddRef) value._AddRef();
      path[name]=value;
    }
  },

  setIntfL: function(old,value,skipAddRef){
    //console.log('rtl.setIntfL old="'+(old?old.$name:'null')+'" value="'+(value?value.$name:'null')+'"');
    if (old !== value){
      if (value!==null){
        if (!skipAddRef) value._AddRef();
      }
      if (old!==null){
        old._Release();  // Release after AddRef, to avoid double Release if Release creates an exception
      }
    } else if (skipAddRef){
      if (old!==null){
        old._Release();  // value has an AddRef
      }
    }
    return value;
  },

  _AddRef: function(intf){
    //if (intf) console.log('rtl._AddRef intf="'+(intf?intf.$name:'null')+'"');
    if (intf) intf._AddRef();
    return intf;
  },

  _Release: function(intf){
    //if (intf) console.log('rtl._Release intf="'+(intf?intf.$name:'null')+'"');
    if (intf) intf._Release();
    return intf;
  },

  trunc: function(a){
    return a<0 ? Math.ceil(a) : Math.floor(a);
  },

  checkMethodCall: function(obj,type){
    if (rtl.isObject(obj) && rtl.is(obj,type)) return;
    rtl.raiseE("EInvalidCast");
  },

  oc: function(i){
    // overflow check integer
    if ((Math.floor(i)===i) && (i>=-0x1fffffffffffff) && (i<=0x1fffffffffffff)) return i;
    rtl.raiseE('EIntOverflow');
  },

  rc: function(i,minval,maxval){
    // range check integer
    if ((Math.floor(i)===i) && (i>=minval) && (i<=maxval)) return i;
    rtl.raiseE('ERangeError');
  },

  rcc: function(c,minval,maxval){
    // range check char
    if ((typeof(c)==='string') && (c.length===1)){
      var i = c.charCodeAt(0);
      if ((i>=minval) && (i<=maxval)) return c;
    }
    rtl.raiseE('ERangeError');
  },

  rcSetCharAt: function(s,index,c){
    // range check setCharAt
    if ((typeof(s)!=='string') || (index<0) || (index>=s.length)) rtl.raiseE('ERangeError');
    return rtl.setCharAt(s,index,c);
  },

  rcCharAt: function(s,index){
    // range check charAt
    if ((typeof(s)!=='string') || (index<0) || (index>=s.length)) rtl.raiseE('ERangeError');
    return s.charAt(index);
  },

  rcArrR: function(arr,index){
    // range check read array
    if (Array.isArray(arr) && (typeof(index)==='number') && (index>=0) && (index<arr.length)){
      if (arguments.length>2){
        // arr,index1,index2,...
        arr=arr[index];
        for (var i=2; i<arguments.length; i++) arr=rtl.rcArrR(arr,arguments[i]);
        return arr;
      }
      return arr[index];
    }
    rtl.raiseE('ERangeError');
  },

  rcArrW: function(arr,index,value){
    // range check write array
    // arr,index1,index2,...,value
    for (var i=3; i<arguments.length; i++){
      arr=rtl.rcArrR(arr,index);
      index=arguments[i-1];
      value=arguments[i];
    }
    if (Array.isArray(arr) && (typeof(index)==='number') && (index>=0) && (index<arr.length)){
      return arr[index]=value;
    }
    rtl.raiseE('ERangeError');
  },

  length: function(arr){
    return (arr == null) ? 0 : arr.length;
  },

  arrayRef: function(a){
    if (a!=null) rtl.hideProp(a,'$pas2jsrefcnt',1);
    return a;
  },

  arraySetLength: function(arr,defaultvalue,newlength){
    var stack = [];
    var s = 9999;
    for (var i=2; i<arguments.length; i++){
      var j = arguments[i];
      if (j==='s'){ s = i-2; }
      else {
        stack.push({ dim:j+0, a:null, i:0, src:null });
      }
    }
    var dimmax = stack.length-1;
    var depth = 0;
    var lastlen = 0;
    var item = null;
    var a = null;
    var src = arr;
    var srclen = 0, oldlen = 0;
    do{
      if (depth>0){
        item=stack[depth-1];
        src = (item.src && item.src.length>item.i)?item.src[item.i]:null;
      }
      if (!src){
        a = [];
        srclen = 0;
        oldlen = 0;
      } else if (src.$pas2jsrefcnt>0 || depth>=s){
        a = [];
        srclen = src.length;
        oldlen = srclen;
      } else {
        a = src;
        srclen = 0;
        oldlen = a.length;
      }
      lastlen = stack[depth].dim;
      a.length = lastlen;
      if (depth>0){
        item.a[item.i]=a;
        item.i++;
        if ((lastlen===0) && (item.i<item.a.length)) continue;
      }
      if (lastlen>0){
        if (depth<dimmax){
          item = stack[depth];
          item.a = a;
          item.i = 0;
          item.src = src;
          depth++;
          continue;
        } else {
          if (srclen>lastlen) srclen=lastlen;
          if (rtl.isArray(defaultvalue)){
            // array of dyn array
            for (var i=0; i<srclen; i++) a[i]=src[i];
            for (var i=oldlen; i<lastlen; i++) a[i]=[];
          } else if (rtl.isObject(defaultvalue)) {
            if (rtl.isTRecord(defaultvalue)){
              // array of record
              for (var i=0; i<srclen; i++) a[i]=defaultvalue.$clone(src[i]);
              for (var i=oldlen; i<lastlen; i++) a[i]=defaultvalue.$new();
            } else {
              // array of set
              for (var i=0; i<srclen; i++) a[i]=rtl.refSet(src[i]);
              for (var i=oldlen; i<lastlen; i++) a[i]={};
            }
          } else {
            for (var i=0; i<srclen; i++) a[i]=src[i];
            for (var i=oldlen; i<lastlen; i++) a[i]=defaultvalue;
          }
        }
      }
      // backtrack
      while ((depth>0) && (stack[depth-1].i>=stack[depth-1].dim)){
        depth--;
      };
      if (depth===0){
        if (dimmax===0) return a;
        return stack[0].a;
      }
    }while (true);
  },

  arrayEq: function(a,b){
    if (a===null) return b===null;
    if (b===null) return false;
    if (a.length!==b.length) return false;
    for (var i=0; i<a.length; i++) if (a[i]!==b[i]) return false;
    return true;
  },

  arrayClone: function(type,src,srcpos,endpos,dst,dstpos){
    // type: 0 for references, "refset" for calling refSet(), a function for new type()
    // src must not be null
    // This function does not range check.
    if(type === 'refSet') {
      for (; srcpos<endpos; srcpos++) dst[dstpos++] = rtl.refSet(src[srcpos]); // ref set
    } else if (rtl.isTRecord(type)){
      for (; srcpos<endpos; srcpos++) dst[dstpos++] = type.$clone(src[srcpos]); // clone record
    }  else {
      for (; srcpos<endpos; srcpos++) dst[dstpos++] = src[srcpos]; // reference
    };
  },

  arrayConcat: function(type){
    // type: see rtl.arrayClone
    var a = [];
    var l = 0;
    for (var i=1; i<arguments.length; i++){
      var src = arguments[i];
      if (src !== null) l+=src.length;
    };
    a.length = l;
    l=0;
    for (var i=1; i<arguments.length; i++){
      var src = arguments[i];
      if (src === null) continue;
      rtl.arrayClone(type,src,0,src.length,a,l);
      l+=src.length;
    };
    return a;
  },

  arrayConcatN: function(){
    var a = null;
    for (var i=0; i<arguments.length; i++){
      var src = arguments[i];
      if (src === null) continue;
      if (a===null){
        a=rtl.arrayRef(src); // Note: concat(a) does not clone
      } else {
        a=a.concat(src);
      }
    };
    return a;
  },

  arrayCopy: function(type, srcarray, index, count){
    // type: see rtl.arrayClone
    // if count is missing, use srcarray.length
    if (srcarray === null) return [];
    if (index < 0) index = 0;
    if (count === undefined) count=srcarray.length;
    var end = index+count;
    if (end>srcarray.length) end = srcarray.length;
    if (index>=end) return [];
    if (type===0){
      return srcarray.slice(index,end);
    } else {
      var a = [];
      a.length = end-index;
      rtl.arrayClone(type,srcarray,index,end,a,0);
      return a;
    }
  },

  setCharAt: function(s,index,c){
    return s.substr(0,index)+c+s.substr(index+1);
  },

  getResStr: function(mod,name){
    var rs = mod.$resourcestrings[name];
    return rs.current?rs.current:rs.org;
  },

  createSet: function(){
    var s = {};
    for (var i=0; i<arguments.length; i++){
      if (arguments[i]!=null){
        s[arguments[i]]=true;
      } else {
        var first=arguments[i+=1];
        var last=arguments[i+=1];
        for(var j=first; j<=last; j++) s[j]=true;
      }
    }
    return s;
  },

  cloneSet: function(s){
    var r = {};
    for (var key in s) r[key]=true;
    return r;
  },

  refSet: function(s){
    rtl.hideProp(s,'$shared',true);
    return s;
  },

  includeSet: function(s,enumvalue){
    if (s.$shared) s = rtl.cloneSet(s);
    s[enumvalue] = true;
    return s;
  },

  excludeSet: function(s,enumvalue){
    if (s.$shared) s = rtl.cloneSet(s);
    delete s[enumvalue];
    return s;
  },

  diffSet: function(s,t){
    var r = {};
    for (var key in s) if (!t[key]) r[key]=true;
    return r;
  },

  unionSet: function(s,t){
    var r = {};
    for (var key in s) r[key]=true;
    for (var key in t) r[key]=true;
    return r;
  },

  intersectSet: function(s,t){
    var r = {};
    for (var key in s) if (t[key]) r[key]=true;
    return r;
  },

  symDiffSet: function(s,t){
    var r = {};
    for (var key in s) if (!t[key]) r[key]=true;
    for (var key in t) if (!s[key]) r[key]=true;
    return r;
  },

  eqSet: function(s,t){
    for (var key in s) if (!t[key]) return false;
    for (var key in t) if (!s[key]) return false;
    return true;
  },

  neSet: function(s,t){
    return !rtl.eqSet(s,t);
  },

  leSet: function(s,t){
    for (var key in s) if (!t[key]) return false;
    return true;
  },

  geSet: function(s,t){
    for (var key in t) if (!s[key]) return false;
    return true;
  },

  strSetLength: function(s,newlen){
    var oldlen = s.length;
    if (oldlen > newlen){
      return s.substring(0,newlen);
    } else if (s.repeat){
      // Note: repeat needs ECMAScript6!
      return s+' '.repeat(newlen-oldlen);
    } else {
       while (oldlen<newlen){
         s+=' ';
         oldlen++;
       };
       return s;
    }
  },

  spaceLeft: function(s,width){
    var l=s.length;
    if (l>=width) return s;
    if (s.repeat){
      // Note: repeat needs ECMAScript6!
      return ' '.repeat(width-l) + s;
    } else {
      while (l<width){
        s=' '+s;
        l++;
      };
      return s;
    };
  },

  floatToStr: function(d,w,p){
    // input 1-3 arguments: double, width, precision
    if (arguments.length>2){
      return rtl.spaceLeft(d.toFixed(p),w);
    } else {
	  // exponent width
	  var pad = "";
	  var ad = Math.abs(d);
	  if (ad<1.0e+10) {
		pad='00';
	  } else if (ad<1.0e+100) {
		pad='0';
      }  	
	  if (arguments.length<2) {
	    w=9;		
      } else if (w<9) {
		w=9;
      }		  
      var p = w-8;
      var s=(d>0 ? " " : "" ) + d.toExponential(p);
      s=s.replace(/e(.)/,'E$1'+pad);
      return rtl.spaceLeft(s,w);
    }
  },

  valEnum: function(s, enumType, setCodeFn){
    s = s.toLowerCase();
    for (var key in enumType){
      if((typeof(key)==='string') && (key.toLowerCase()===s)){
        setCodeFn(0);
        return enumType[key];
      }
    }
    setCodeFn(1);
    return 0;
  },

  lw: function(l){
    // fix longword bitwise operation
    return l<0?l+0x100000000:l;
  },

  and: function(a,b){
    var hi = 0x80000000;
    var low = 0x7fffffff;
    var h = (a / hi) & (b / hi);
    var l = (a & low) & (b & low);
    return h*hi + l;
  },

  or: function(a,b){
    var hi = 0x80000000;
    var low = 0x7fffffff;
    var h = (a / hi) | (b / hi);
    var l = (a & low) | (b & low);
    return h*hi + l;
  },

  xor: function(a,b){
    var hi = 0x80000000;
    var low = 0x7fffffff;
    var h = (a / hi) ^ (b / hi);
    var l = (a & low) ^ (b & low);
    return h*hi + l;
  },

  shr: function(a,b){
    if (a<0) a += rtl.hiInt;
    if (a<0x80000000) return a >> b;
    if (b<=0) return a;
    if (b>54) return 0;
    return Math.floor(a / Math.pow(2,b));
  },

  shl: function(a,b){
    if (a<0) a += rtl.hiInt;
    if (b<=0) return a;
    if (b>54) return 0;
    var r = a * Math.pow(2,b);
    if (r <= rtl.hiInt) return r;
    return r % rtl.hiInt;
  },

  initRTTI: function(){
    if (rtl.debug_rtti) rtl.debug('initRTTI');

    // base types
    rtl.tTypeInfo = { name: "tTypeInfo" };
    function newBaseTI(name,kind,ancestor){
      if (!ancestor) ancestor = rtl.tTypeInfo;
      if (rtl.debug_rtti) rtl.debug('initRTTI.newBaseTI "'+name+'" '+kind+' ("'+ancestor.name+'")');
      var t = Object.create(ancestor);
      t.name = name;
      t.kind = kind;
      rtl[name] = t;
      return t;
    };
    function newBaseInt(name,minvalue,maxvalue,ordtype){
      var t = newBaseTI(name,1 /* tkInteger */,rtl.tTypeInfoInteger);
      t.minvalue = minvalue;
      t.maxvalue = maxvalue;
      t.ordtype = ordtype;
      return t;
    };
    newBaseTI("tTypeInfoInteger",1 /* tkInteger */);
    newBaseInt("shortint",-0x80,0x7f,0);
    newBaseInt("byte",0,0xff,1);
    newBaseInt("smallint",-0x8000,0x7fff,2);
    newBaseInt("word",0,0xffff,3);
    newBaseInt("longint",-0x80000000,0x7fffffff,4);
    newBaseInt("longword",0,0xffffffff,5);
    newBaseInt("nativeint",-0x10000000000000,0xfffffffffffff,6);
    newBaseInt("nativeuint",0,0xfffffffffffff,7);
    newBaseTI("char",2 /* tkChar */);
    newBaseTI("string",3 /* tkString */);
    newBaseTI("tTypeInfoEnum",4 /* tkEnumeration */,rtl.tTypeInfoInteger);
    newBaseTI("tTypeInfoSet",5 /* tkSet */);
    newBaseTI("double",6 /* tkDouble */);
    newBaseTI("boolean",7 /* tkBool */);
    newBaseTI("tTypeInfoProcVar",8 /* tkProcVar */);
    newBaseTI("tTypeInfoMethodVar",9 /* tkMethod */,rtl.tTypeInfoProcVar);
    newBaseTI("tTypeInfoArray",10 /* tkArray */);
    newBaseTI("tTypeInfoDynArray",11 /* tkDynArray */);
    newBaseTI("tTypeInfoPointer",15 /* tkPointer */);
    var t = newBaseTI("pointer",15 /* tkPointer */,rtl.tTypeInfoPointer);
    t.reftype = null;
    newBaseTI("jsvalue",16 /* tkJSValue */);
    newBaseTI("tTypeInfoRefToProcVar",17 /* tkRefToProcVar */,rtl.tTypeInfoProcVar);

    // member kinds
    rtl.tTypeMember = {};
    function newMember(name,kind){
      var m = Object.create(rtl.tTypeMember);
      m.name = name;
      m.kind = kind;
      rtl[name] = m;
    };
    newMember("tTypeMemberField",1); // tmkField
    newMember("tTypeMemberMethod",2); // tmkMethod
    newMember("tTypeMemberProperty",3); // tmkProperty

    // base object for storing members: a simple object
    rtl.tTypeMembers = {};

    // tTypeInfoStruct - base object for tTypeInfoClass, tTypeInfoRecord, tTypeInfoInterface
    var tis = newBaseTI("tTypeInfoStruct",0);
    tis.$addMember = function(name,ancestor,options){
      if (rtl.debug_rtti){
        if (!rtl.hasString(name) || (name.charAt()==='$')) throw 'invalid member "'+name+'", this="'+this.name+'"';
        if (!rtl.is(ancestor,rtl.tTypeMember)) throw 'invalid ancestor "'+ancestor+':'+ancestor.name+'", "'+this.name+'.'+name+'"';
        if ((options!=undefined) && (typeof(options)!='object')) throw 'invalid options "'+options+'", "'+this.name+'.'+name+'"';
      };
      var t = Object.create(ancestor);
      t.name = name;
      this.members[name] = t;
      this.names.push(name);
      if (rtl.isObject(options)){
        for (var key in options) if (options.hasOwnProperty(key)) t[key] = options[key];
      };
      return t;
    };
    tis.addField = function(name,type,options){
      var t = this.$addMember(name,rtl.tTypeMemberField,options);
      if (rtl.debug_rtti){
        if (!rtl.is(type,rtl.tTypeInfo)) throw 'invalid type "'+type+'", "'+this.name+'.'+name+'"';
      };
      t.typeinfo = type;
      this.fields.push(name);
      return t;
    };
    tis.addFields = function(){
      var i=0;
      while(i<arguments.length){
        var name = arguments[i++];
        var type = arguments[i++];
        if ((i<arguments.length) && (typeof(arguments[i])==='object')){
          this.addField(name,type,arguments[i++]);
        } else {
          this.addField(name,type);
        };
      };
    };
    tis.addMethod = function(name,methodkind,params,result,options){
      var t = this.$addMember(name,rtl.tTypeMemberMethod,options);
      t.methodkind = methodkind;
      t.procsig = rtl.newTIProcSig(params);
      t.procsig.resulttype = result?result:null;
      this.methods.push(name);
      return t;
    };
    tis.addProperty = function(name,flags,result,getter,setter,options){
      var t = this.$addMember(name,rtl.tTypeMemberProperty,options);
      t.flags = flags;
      t.typeinfo = result;
      t.getter = getter;
      t.setter = setter;
      // Note: in options: params, stored, defaultvalue
      if (rtl.isArray(t.params)) t.params = rtl.newTIParams(t.params);
      this.properties.push(name);
      if (!rtl.isString(t.stored)) t.stored = "";
      return t;
    };
    tis.getField = function(index){
      return this.members[this.fields[index]];
    };
    tis.getMethod = function(index){
      return this.members[this.methods[index]];
    };
    tis.getProperty = function(index){
      return this.members[this.properties[index]];
    };

    newBaseTI("tTypeInfoRecord",12 /* tkRecord */,rtl.tTypeInfoStruct);
    newBaseTI("tTypeInfoClass",13 /* tkClass */,rtl.tTypeInfoStruct);
    newBaseTI("tTypeInfoClassRef",14 /* tkClassRef */);
    newBaseTI("tTypeInfoInterface",18 /* tkInterface */,rtl.tTypeInfoStruct);
    newBaseTI("tTypeInfoHelper",19 /* tkHelper */,rtl.tTypeInfoStruct);
    newBaseTI("tTypeInfoExtClass",20 /* tkExtClass */,rtl.tTypeInfoClass);
  },

  tSectionRTTI: {
    $module: null,
    $inherited: function(name,ancestor,o){
      if (rtl.debug_rtti){
        rtl.debug('tSectionRTTI.newTI "'+(this.$module?this.$module.$name:"(no module)")
          +'"."'+name+'" ('+ancestor.name+') '+(o?'init':'forward'));
      };
      var t = this[name];
      if (t){
        if (!t.$forward) throw 'duplicate type "'+name+'"';
        if (!ancestor.isPrototypeOf(t)) throw 'typeinfo ancestor mismatch "'+name+'" ancestor="'+ancestor.name+'" t.name="'+t.name+'"';
      } else {
        t = Object.create(ancestor);
        t.name = name;
        t.$module = this.$module;
        this[name] = t;
      }
      if (o){
        delete t.$forward;
        for (var key in o) if (o.hasOwnProperty(key)) t[key]=o[key];
      } else {
        t.$forward = true;
      }
      return t;
    },
    $Scope: function(name,ancestor,o){
      var t=this.$inherited(name,ancestor,o);
      t.members = {};
      t.names = [];
      t.fields = [];
      t.methods = [];
      t.properties = [];
      return t;
    },
    $TI: function(name,kind,o){ var t=this.$inherited(name,rtl.tTypeInfo,o); t.kind = kind; return t; },
    $Int: function(name,o){ return this.$inherited(name,rtl.tTypeInfoInteger,o); },
    $Enum: function(name,o){ return this.$inherited(name,rtl.tTypeInfoEnum,o); },
    $Set: function(name,o){ return this.$inherited(name,rtl.tTypeInfoSet,o); },
    $StaticArray: function(name,o){ return this.$inherited(name,rtl.tTypeInfoArray,o); },
    $DynArray: function(name,o){ return this.$inherited(name,rtl.tTypeInfoDynArray,o); },
    $ProcVar: function(name,o){ return this.$inherited(name,rtl.tTypeInfoProcVar,o); },
    $RefToProcVar: function(name,o){ return this.$inherited(name,rtl.tTypeInfoRefToProcVar,o); },
    $MethodVar: function(name,o){ return this.$inherited(name,rtl.tTypeInfoMethodVar,o); },
    $Record: function(name,o){ return this.$Scope(name,rtl.tTypeInfoRecord,o); },
    $Class: function(name,o){ return this.$Scope(name,rtl.tTypeInfoClass,o); },
    $ClassRef: function(name,o){ return this.$inherited(name,rtl.tTypeInfoClassRef,o); },
    $Pointer: function(name,o){ return this.$inherited(name,rtl.tTypeInfoPointer,o); },
    $Interface: function(name,o){ return this.$Scope(name,rtl.tTypeInfoInterface,o); },
    $Helper: function(name,o){ return this.$Scope(name,rtl.tTypeInfoHelper,o); },
    $ExtClass: function(name,o){ return this.$Scope(name,rtl.tTypeInfoExtClass,o); }
  },

  newTIParam: function(param){
    // param is an array, 0=name, 1=type, 2=optional flags
    var t = {
      name: param[0],
      typeinfo: param[1],
      flags: (rtl.isNumber(param[2]) ? param[2] : 0)
    };
    return t;
  },

  newTIParams: function(list){
    // list: optional array of [paramname,typeinfo,optional flags]
    var params = [];
    if (rtl.isArray(list)){
      for (var i=0; i<list.length; i++) params.push(rtl.newTIParam(list[i]));
    };
    return params;
  },

  newTIProcSig: function(params,result,flags){
    var s = {
      params: rtl.newTIParams(params),
      resulttype: result,
      flags: flags
    };
    return s;
  },

  addResource: function(aRes){
    rtl.$res[aRes.name]=aRes;
  },

  getResource: function(aName){
    var res = rtl.$res[aName];
    if (res !== undefined) {
      return res;
    } else {
      return null;
    }
  },

  getResourceList: function(){
    return Object.keys(rtl.$res);
  }
}

rtl.module("System",[],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.MaxLongint = 0x7fffffff;
  this.Maxint = 2147483647;
  rtl.createClass(this,"TObject",null,function () {
    this.$init = function () {
    };
    this.$final = function () {
    };
    this.Create = function () {
      return this;
    };
    this.AfterConstruction = function () {
    };
    this.BeforeDestruction = function () {
    };
  });
  this.Random = function (Range) {
    return Math.floor(Math.random()*Range);
  };
  this.Copy = function (S, Index, Size) {
    if (Index<1) Index = 1;
    return (Size>0) ? S.substring(Index-1,Index+Size-1) : "";
  };
  this.Copy$1 = function (S, Index) {
    if (Index<1) Index = 1;
    return S.substr(Index-1);
  };
  this.Delete = function (S, Index, Size) {
    var h = "";
    if ((Index < 1) || (Index > S.get().length) || (Size <= 0)) return;
    h = S.get();
    S.set($mod.Copy(h,1,Index - 1) + $mod.Copy$1(h,Index + Size));
  };
  this.Pos = function (Search, InString) {
    return InString.indexOf(Search)+1;
  };
  this.upcase = function (c) {
    return c.toUpperCase();
  };
  this.StringOfChar = function (c, l) {
    var Result = "";
    var i = 0;
    if ((l>0) && c.repeat) return c.repeat(l);
    Result = "";
    for (var $l = 1, $end = l; $l <= $end; $l++) {
      i = $l;
      Result = Result + c;
    };
    return Result;
  };
  this.SetWriteCallBack = function (H) {
    var Result = null;
    Result = $impl.WriteCallBack;
    $impl.WriteCallBack = H;
    return Result;
  };
  $mod.$implcode = function () {
    $impl.WriteCallBack = null;
  };
  $mod.$init = function () {
    rtl.exitcode = 0;
  };
},[]);
rtl.module("JS",["System"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("Web",["System","JS"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("SysUtils",["System","JS"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.LeftStr = function (S, Count) {
    return (Count>0) ? S.substr(0,Count) : "";
  };
  this.RightStr = function (S, Count) {
    var l = S.length;
    return (Count<1) ? "" : ( Count>=l ? S : S.substr(l-Count));
  };
  this.Trim = function (S) {
    return S.replace(/^[\s\uFEFF\xA0\x00-\x1f]+/,'').replace(/[\s\uFEFF\xA0\x00-\x1f]+$/,'');
  };
  this.LowerCase = function (s) {
    return s.toLowerCase();
  };
  this.TStringReplaceFlag = {"0": "rfReplaceAll", rfReplaceAll: 0, "1": "rfIgnoreCase", rfIgnoreCase: 1};
  this.StringReplace = function (aOriginal, aSearch, aReplace, Flags) {
    var Result = "";
    var REFlags = "";
    var REString = "";
    REFlags = "";
    if ($mod.TStringReplaceFlag.rfReplaceAll in Flags) REFlags = "g";
    if ($mod.TStringReplaceFlag.rfIgnoreCase in Flags) REFlags = REFlags + "i";
    REString = aSearch.replace(new RegExp($impl.RESpecials,"g"),"\\$1");
    Result = aOriginal.replace(new RegExp(REString,REFlags),aReplace);
    return Result;
  };
  $mod.$implcode = function () {
    $impl.RESpecials = "([\\$\\+\\[\\]\\(\\)\\\\\\.\\*\\^\\?])";
  };
},[]);
rtl.module("Classes",["System","SysUtils","JS"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  rtl.createClass(this,"TLoadHelper",pas.System.TObject,function () {
  });
  this.SetLoadHelperClass = function (aClass) {
    var Result = null;
    Result = $impl.GlobalLoadHelper;
    $impl.GlobalLoadHelper = aClass;
    return Result;
  };
  $mod.$implcode = function () {
    $impl.GlobalLoadHelper = null;
    $impl.ClassList = null;
  };
  $mod.$init = function () {
    $impl.ClassList = new Object();
  };
},[]);
rtl.module("Rtl.BrowserLoadHelper",["System","Classes","SysUtils","JS","Web"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass(this,"TBrowserLoadHelper",pas.Classes.TLoadHelper,function () {
  });
  $mod.$init = function () {
    pas.Classes.SetLoadHelperClass($mod.TBrowserLoadHelper);
  };
});
rtl.module("browserconsole",["System","JS","Web","Rtl.BrowserLoadHelper","SysUtils"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.BrowserLineBreak = "\n";
  this.DefaultMaxConsoleLines = 25;
  this.DefaultConsoleStyle = ".pasconsole { " + this.BrowserLineBreak + "font-family: courier;" + this.BrowserLineBreak + "font-size: 14px;" + this.BrowserLineBreak + "background: #FFFFFF;" + this.BrowserLineBreak + "color: #000000;" + this.BrowserLineBreak + "display: block;" + this.BrowserLineBreak + "}";
  this.ConsoleElementID = "";
  this.ConsoleStyle = "";
  this.MaxConsoleLines = 0;
  this.ConsoleLinesToBrowserLog = false;
  this.ResetConsole = function () {
    if ($impl.LinesParent === null) return;
    while ($impl.LinesParent.firstElementChild !== null) $impl.LinesParent.removeChild($impl.LinesParent.firstElementChild);
    $impl.AppendLine();
  };
  this.InitConsole = function () {
    if ($impl.ConsoleElement === null) return;
    if ($impl.ConsoleElement.nodeName.toLowerCase() !== "body") {
      while ($impl.ConsoleElement.firstElementChild !== null) $impl.ConsoleElement.removeChild($impl.ConsoleElement.firstElementChild);
    };
    $impl.StyleElement = document.createElement("style");
    $impl.StyleElement.innerText = $mod.ConsoleStyle;
    $impl.ConsoleElement.appendChild($impl.StyleElement);
    $impl.LinesParent = document.createElement("div");
    $impl.ConsoleElement.appendChild($impl.LinesParent);
  };
  this.HookConsole = function () {
    $impl.ConsoleElement = null;
    if ($mod.ConsoleElementID !== "") $impl.ConsoleElement = document.getElementById($mod.ConsoleElementID);
    if ($impl.ConsoleElement === null) $impl.ConsoleElement = document.body;
    if ($impl.ConsoleElement === null) return;
    $mod.InitConsole();
    $mod.ResetConsole();
    pas.System.SetWriteCallBack($impl.WriteConsole);
  };
  $mod.$implcode = function () {
    $impl.LastLine = null;
    $impl.StyleElement = null;
    $impl.LinesParent = null;
    $impl.ConsoleElement = null;
    $impl.AppendLine = function () {
      var CurrentCount = 0;
      var S = null;
      CurrentCount = 0;
      S = $impl.LinesParent.firstChild;
      while (S != null) {
        CurrentCount += 1;
        S = S.nextSibling;
      };
      while (CurrentCount > $mod.MaxConsoleLines) {
        CurrentCount -= 1;
        $impl.LinesParent.removeChild($impl.LinesParent.firstChild);
      };
      $impl.LastLine = document.createElement("div");
      $impl.LastLine.className = "pasconsole";
      $impl.LinesParent.appendChild($impl.LastLine);
    };
    $impl.WriteConsole = function (S, NewLine) {
      var CL = "";
      CL = $impl.LastLine.innerHTML;
      CL = CL + ("" + S);
      CL = pas.SysUtils.StringReplace(CL,"<","&lt;",rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll));
      CL = pas.SysUtils.StringReplace(CL,">","&gt;",rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll));
      CL = pas.SysUtils.StringReplace(CL," ","&nbsp;",rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll));
      CL = pas.SysUtils.StringReplace(CL,"\r\n","<br>",rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll));
      CL = pas.SysUtils.StringReplace(CL,"\n","<br>",rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll));
      CL = pas.SysUtils.StringReplace(CL,"\r","<br>",rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll));
      $impl.LastLine.innerHTML = CL;
      if (NewLine) {
        if ($mod.ConsoleLinesToBrowserLog) window.console.log($impl.LastLine.innerText);
        $impl.AppendLine();
      };
    };
  };
  $mod.$init = function () {
    $mod.ConsoleLinesToBrowserLog = true;
    $mod.ConsoleElementID = "pasjsconsole";
    $mod.ConsoleStyle = $mod.DefaultConsoleStyle;
    $mod.MaxConsoleLines = 25;
    $mod.HookConsole();
  };
},[]);
rtl.module("strutils",["System","SysUtils"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.MidStr = function (AText, AStart, ACount) {
    var Result = "";
    if ((ACount === 0) || (AStart > AText.length)) return "";
    Result = pas.System.Copy(AText,AStart,ACount);
    return Result;
  };
  this.Soundex = function (AText, ALength) {
    var Result = "";
    var S = "";
    var PS = "";
    var I = 0;
    var L = 0;
    Result = "";
    PS = "\x00";
    if (AText.length > 0) {
      Result = pas.System.upcase(AText.charAt(0));
      I = 2;
      L = AText.length;
      while ((I <= L) && (Result.length < ALength)) {
        S = $impl.SScore.charAt(AText.charCodeAt(I - 1) - 1);
        if (!(S.charCodeAt() in rtl.createSet(48,105,PS.charCodeAt()))) Result = Result + S;
        if (S !== "i") PS = S;
        I += 1;
      };
    };
    L = Result.length;
    if (L < ALength) Result = Result + pas.System.StringOfChar("0",ALength - L);
    return Result;
  };
  this.SoundexSimilar = function (AText, AOther, ALength) {
    var Result = false;
    Result = $mod.Soundex(AText,ALength) === $mod.Soundex(AOther,ALength);
    return Result;
  };
  this.SoundexSimilar$1 = function (AText, AOther) {
    var Result = false;
    Result = $mod.SoundexSimilar(AText,AOther,4);
    return Result;
  };
  this.SoundexProc = function (AText, AOther) {
    var Result = false;
    Result = $mod.SoundexSimilar$1(AText,AOther);
    return Result;
  };
  this.AnsiResemblesProc = null;
  this.ResemblesProc = null;
  this.DelSpace1 = function (S) {
    var Result = "";
    var I = 0;
    Result = S;
    for (var $l = Result.length; $l >= 2; $l--) {
      I = $l;
      if ((Result.charAt(I - 1) === " ") && (Result.charAt(I - 1 - 1) === " ")) pas.System.Delete({get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},I,1);
    };
    return Result;
  };
  $mod.$implcode = function () {
    $impl.SScore = "00000000000000000000000000000000" + "00000000000000000000000000000000" + "0123012i02245501262301i2i2" + "000000" + "0123012i02245501262301i2i2" + "00000000000000000000000000000000" + "00000000000000000000000000000000" + "00000000000000000000000000000000" + "00000000000000000000000000000000" + "00000";
  };
  $mod.$init = function () {
    $mod.AnsiResemblesProc = $mod.SoundexProc;
    $mod.ResemblesProc = $mod.SoundexProc;
  };
},["JS"]);
rtl.module("program",["System","browserconsole","Classes","JS","strutils","SysUtils","Web"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass(this,"TSlabixApp",pas.System.TObject,function () {
    this.DoActivity = function (aEvent) {
      var Result = false;
      document.getElementById("divnohelpbutton").setAttribute("hidden","");
      document.getElementById("divhelpbutton").setAttribute("hidden","");
      var $tmp = $mod.Activity;
      if ($tmp === "welcome") {
        document.getElementById("divwelcome").setAttribute("hidden","");
      } else if ($tmp === "pleasechoose") {}
      else if ($tmp === "chart") {
        document.getElementById("divchart").setAttribute("hidden","");
        document.getElementById("divcharttext").setAttribute("hidden","");
        document.getElementById("divhelpchart").setAttribute("hidden","");
      } else if ($tmp === "onesyllabic") {
        document.getElementById("divsyllabic").setAttribute("hidden","");
        document.getElementById("divquestionorder").setAttribute("hidden","");
        document.getElementById("divanswermakeup").setAttribute("hidden","");
        document.getElementById("divhelponesyllabic").setAttribute("hidden","");
      } else if ($tmp === "oneword") {
        document.getElementById("divword").setAttribute("hidden","");
        document.getElementById("divanswermakeup").setAttribute("hidden","");
        document.getElementById("divdefinition").setAttribute("hidden","");
        document.getElementById("divhelponeword").setAttribute("hidden","");
      } else if ($tmp === "convert") {
        document.getElementById("divconvert").setAttribute("hidden","");
        document.getElementById("divhelpconvert").setAttribute("hidden","");
      } else if ($tmp === "about") {
        document.getElementById("divabout").setAttribute("hidden","");
      };
      $mod.Activity = document.getElementById("selactivity").value;
      var $tmp1 = $mod.Activity;
      if ($tmp1 === "pleasechoose") {}
      else if ($tmp1 === "chart") {
        document.getElementById("divchart").removeAttribute("hidden");
        document.getElementById("divcharttext").removeAttribute("hidden");
        document.getElementById("divhelpbutton").removeAttribute("hidden");
        $mod.DisplayChart();
      } else if ($tmp1 === "onesyllabic") {
        document.getElementById("divsyllabic").removeAttribute("hidden");
        document.getElementById("divquestionorder").removeAttribute("hidden");
        document.getElementById("divanswermakeup").removeAttribute("hidden");
        document.getElementById("divhelpbutton").removeAttribute("hidden");
        $mod.Sybuttonmode = "next";
        $mod.Syanswer = "";
        document.getElementById("syllabicimage").setAttribute("src","syimages\/_blank.svg");
        document.getElementById("syllabictext").innerHTML = "&nbsp;";
        document.getElementById("butNext").innerHTML = "<code>" + "Next" + "<\/code>";
      } else if ($tmp1 === "oneword") {
        document.getElementById("divword").removeAttribute("hidden");
        document.getElementById("divanswermakeup").removeAttribute("hidden");
        document.getElementById("divdefinition").removeAttribute("hidden");
        document.getElementById("divhelpbutton").removeAttribute("hidden");
        $mod.Wordanswer = "";
        $mod.Worddefinition = "";
      } else if ($tmp1 === "convert") {
        document.getElementById("divconvert").removeAttribute("hidden");
        document.getElementById("divhelpbutton").removeAttribute("hidden");
        document.getElementById("convtext").value = "";
      } else if ($tmp1 === "about") {
        document.getElementById("divabout").removeAttribute("hidden");
      };
      return Result;
    };
    this.DoQuestionOrder = function (aEvent) {
      var Result = false;
      var v = "*";
      v = document.getElementById("selquestionorder").value;
      var $tmp = v;
      if ($tmp === "random") {
        $mod.Qorder = "random";
      } else if ($tmp === "firstsound") {
        $mod.Qorder = "firstsound";
        $mod.Currentrow = 1;
        $mod.Currentcol = 0;
      } else if ($tmp === "lastsound") {
        $mod.Qorder = "lastsound";
        $mod.Currentrow = 0;
        $mod.Currentcol = 1;
      } else {
        $mod.Qorder = "random";
      };
      return Result;
    };
    this.DoAnswerMakeup = function (aEvent) {
      var Result = false;
      var v = "*";
      v = document.getElementById("selanswermakeup").value;
      var $tmp = v;
      if ($tmp === "text") {
        $mod.Givetext = true;
        $mod.Givevoice = false;
      } else if ($tmp === "voice") {
        $mod.Givetext = false;
        $mod.Givevoice = true;
      } else if ($tmp === "textandvoice") {
        $mod.Givetext = true;
        $mod.Givevoice = true;
      } else {
        $mod.Givetext = false;
        $mod.Givevoice = false;
      };
      return Result;
    };
    this.DoDefinition = function (aEvent) {
      var Result = false;
      var v = "*";
      v = document.getElementById("seldefinition").value;
      var $tmp = v;
      if ($tmp === "yes") {
        $mod.Showdefinition = true;
      } else if ($tmp === "no") {
        $mod.Showdefinition = false;
      };
      return Result;
    };
    this.DoChartText = function (aEvent) {
      var Result = false;
      var v = "*";
      v = document.getElementById("selcharttext").value;
      var $tmp = v;
      if ($tmp === "yes") {
        $mod.Showcharttext = true;
        $mod.ToggleChartText();
      } else if ($tmp === "no") {
        $mod.Showcharttext = false;
        $mod.ToggleChartText();
      };
      return Result;
    };
    this.DoHelp = function (aEvent) {
      var Result = false;
      document.getElementById("divnohelpbutton").removeAttribute("hidden");
      document.getElementById("divhelpbutton").setAttribute("hidden","");
      var $tmp = $mod.Activity;
      if ($tmp === "welcome") {}
      else if ($tmp === "pleasechoose") {}
      else if ($tmp === "chart") {
        document.getElementById("divhelpchart").removeAttribute("hidden");
      } else if ($tmp === "onesyllabic") {
        document.getElementById("divhelponesyllabic").removeAttribute("hidden");
      } else if ($tmp === "oneword") {
        document.getElementById("divhelponeword").removeAttribute("hidden");
      } else if ($tmp === "convert") {
        document.getElementById("divhelpconvert").removeAttribute("hidden");
      } else if ($tmp === "about") ;
      return Result;
    };
    this.DoNoHelp = function (aEvent) {
      var Result = false;
      document.getElementById("divnohelpbutton").setAttribute("hidden","");
      document.getElementById("divhelpbutton").removeAttribute("hidden");
      var $tmp = $mod.Activity;
      if ($tmp === "welcome") {}
      else if ($tmp === "pleasechoose") {}
      else if ($tmp === "chart") {
        document.getElementById("divhelpchart").setAttribute("hidden","");
      } else if ($tmp === "onesyllabic") {
        document.getElementById("divhelponesyllabic").setAttribute("hidden","");
      } else if ($tmp === "oneword") {
        document.getElementById("divhelponeword").setAttribute("hidden","");
      } else if ($tmp === "convert") {
        document.getElementById("divhelpconvert").setAttribute("hidden","");
      } else if ($tmp === "about") ;
      return Result;
    };
    this.DoSyNext = function (aEvent) {
      var Result = false;
      var buttontext = "";
      var fname = "";
      var goodonefound = false;
      var n = 0;
      var sythis = "";
      var $tmp = $mod.Sybuttonmode;
      if ($tmp === "next") {
        var $tmp1 = $mod.Qorder;
        if ($tmp1 === "random") {
          n = pas.System.Random($mod.Sycount) + 1;
          sythis = $mod.Synames[n - 1];
          if (sythis === $mod.Syanswer) {
            n = pas.System.Random($mod.Sycount) + 1;
            sythis = $mod.Synames[n - 1];
          };
        } else if ($tmp1 === "firstsound") {
          goodonefound = false;
          do {
            $mod.Currentcol = $mod.Currentcol + 1;
            if ($mod.Currentcol > $mod.Sycolcount) {
              $mod.Currentcol = 1;
              $mod.Currentrow = $mod.Currentrow + 1;
              if ($mod.Currentrow > $mod.Syrowcount) {
                $mod.Currentrow = 1;
              };
            };
            sythis = $mod.Sytable[$mod.Currentrow - 1][$mod.Currentcol - 1];
            if (sythis !== "*") {
              goodonefound = true;
            };
          } while (!goodonefound);
        } else if ($tmp1 === "lastsound") {
          goodonefound = false;
          do {
            $mod.Currentrow = $mod.Currentrow + 1;
            if ($mod.Currentrow > $mod.Syrowcount) {
              $mod.Currentrow = 1;
              $mod.Currentcol = $mod.Currentcol + 1;
              if ($mod.Currentcol > $mod.Sycolcount) {
                $mod.Currentcol = 1;
              };
            };
            sythis = $mod.Sytable[$mod.Currentrow - 1][$mod.Currentcol - 1];
            if (sythis !== "*") {
              goodonefound = true;
            };
          } while (!goodonefound);
        };
        fname = "syimages\/sy_" + sythis + ".svg";
        document.getElementById("syllabicimage").setAttribute("src",fname);
        document.getElementById("syllabictext").innerHTML = "&nbsp;";
        $mod.Syanswer = sythis;
        if (($mod.Givetext === false) && ($mod.Givevoice === false)) {
          buttontext = "&nbsp;" + "Next" + "&nbsp;";
          $mod.Sybuttonmode = "next";
        } else {
          buttontext = "Answer";
          $mod.Sybuttonmode = "answer";
        };
        document.getElementById("butNext").innerHTML = "<code>" + buttontext + "<\/code>";
      } else if ($tmp === "answer") {
        if ($mod.Givetext === true) {
          document.getElementById("syllabictext").innerHTML = "&nbsp;&nbsp;&nbsp;&nbsp;" + $mod.Syanswer;
        };
        if ($mod.Givevoice === true) {
          document.getElementById("syllabicaudio").setAttribute("src","sysounds\/aud_" + $mod.Syanswer + ".ogg");
        };
        document.getElementById("butNext").innerHTML = "<code>" + "&nbsp;" + "Next" + "&nbsp;" + "<\/code>";
        $mod.Sybuttonmode = "next";
      };
      return Result;
    };
    this.DoWordNext = function (aEvent) {
      var Result = false;
      var buttontext = "";
      var n = 0;
      var wordthis = "";
      var $tmp = $mod.Wordbuttonmode;
      if ($tmp === "next") {
        n = pas.System.Random($mod.Wordcount) + 1;
        wordthis = $mod.Wordnames[n - 1];
        if (wordthis === $mod.Wordanswer) {
          n = pas.System.Random($mod.Wordcount) + 1;
          wordthis = $mod.Wordnames[n - 1];
        };
        $mod.DisplayWordTestSyllabics(wordthis);
        document.getElementById("wordtext").innerHTML = "&nbsp;";
        document.getElementById("worddefinition").innerHTML = "&nbsp;";
        $mod.Wordanswer = wordthis;
        $mod.Worddefinition = $mod.Worddefs[n - 1];
        if (($mod.Givetext === false) && ($mod.Givevoice === false)) {
          buttontext = "<code>" + "&nbsp;" + "Next" + "&nbsp;" + "<\/code>";
          $mod.Wordbuttonmode = "next";
        } else {
          buttontext = "<code>" + "Answer" + "<\/code>";
          $mod.Wordbuttonmode = "answer";
        };
        document.getElementById("butWordNext").innerHTML = "<code>" + buttontext + "<\/code>";
      } else if ($tmp === "answer") {
        if ($mod.Givetext === true) {
          document.getElementById("wordtext").innerHTML = "&nbsp;&nbsp;&nbsp;&nbsp;" + $mod.Wordanswer;
        };
        if ($mod.Showdefinition === true) {
          document.getElementById("worddefinition").innerHTML = "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;" + "(" + $mod.Worddefinition + ")";
        };
        if ($mod.Givevoice === true) {
          document.getElementById("wordaudio").setAttribute("src","sywords\/" + $mod.Wordanswer + ".ogg");
        };
        document.getElementById("butWordNext").innerHTML = "<code>" + "&nbsp;" + "Next" + "&nbsp;" + "<\/code>";
        $mod.Wordbuttonmode = "next";
      };
      return Result;
    };
    this.DoConvert = function (aEvent) {
      var Result = false;
      var currpos = 0;
      var done = false;
      var fname = "";
      var i = 0;
      var imagenum = 0;
      var listlength = 0;
      var s = "";
      var spacepos = 0;
      var thisword = "";
      var v = "";
      var ws = "";
      v = document.getElementById("convtext").value;
      v = pas.SysUtils.LowerCase(v);
      listlength = v.length;
      for (var $l = 1, $end = listlength; $l <= $end; $l++) {
        i = $l;
        if (pas.System.Pos(pas.strutils.MidStr(v,i,1),"abcdefghijklmnopqrstuvwxyz") === 0) {
          v = pas.SysUtils.LeftStr(v,i - 1) + " " + pas.SysUtils.RightStr(v,listlength - i);
        };
      };
      v = pas.SysUtils.Trim(v);
      v = pas.strutils.DelSpace1(v);
      v = v + " ";
      listlength = v.length;
      currpos = 0;
      imagenum = 0;
      done = false;
      do {
        currpos = currpos + 1;
        if (currpos > listlength) {
          done = true;
          continue;
        };
        spacepos = pas.System.Pos(" ",pas.SysUtils.RightStr(v,listlength - (currpos - 1)));
        if (spacepos === 0) {
          done = true;
          continue;
        };
        spacepos = spacepos + (currpos - 1);
        thisword = pas.strutils.MidStr(v,currpos,spacepos - 1 - (currpos - 1));
        currpos = spacepos;
        ws = $mod.MakeSyllables(thisword);
        $mod.TweakSyllables(ws);
        if ($mod.Wordsycount === 0) {
          continue;
        };
        if ((imagenum + $mod.Wordsycount) > $mod.Convertimagemax) {
          done = true;
          continue;
        };
        for (var $l1 = 1, $end1 = $mod.Wordsycount; $l1 <= $end1; $l1++) {
          i = $l1;
          imagenum = imagenum + 1;
          s = "" + imagenum;
          fname = "syimages\/sy_" + $mod.Wordsy[i - 1] + ".svg";
          document.getElementById("convimage" + s).setAttribute("src",fname);
        };
        if (imagenum < $mod.Convertimagemax) {
          imagenum = imagenum + 1;
          s = "" + imagenum;
          fname = "syimages\/_blank.svg";
          document.getElementById("convimage" + s).setAttribute("src",fname);
        };
      } while (!done);
      for (var $l2 = imagenum + 1, $end2 = $mod.Convertimagemax; $l2 <= $end2; $l2++) {
        i = $l2;
        s = "" + i;
        fname = "syimages\/_blank.svg";
        document.getElementById("convimage" + s).setAttribute("src",fname);
      };
      return Result;
    };
    this.Run = function () {
      document.getElementById("butHelp").onclick = rtl.createSafeCallback(this,"DoHelp");
      document.getElementById("butNoHelp").onclick = rtl.createSafeCallback(this,"DoNoHelp");
      document.getElementById("butNext").onclick = rtl.createSafeCallback(this,"DoSyNext");
      document.getElementById("butWordNext").onclick = rtl.createSafeCallback(this,"DoWordNext");
      document.getElementById("butConvert").onclick = rtl.createSafeCallback(this,"DoConvert");
      document.getElementById("selactivity").onchange = rtl.createSafeCallback(this,"DoActivity");
      document.getElementById("selquestionorder").onchange = rtl.createSafeCallback(this,"DoQuestionOrder");
      document.getElementById("selanswermakeup").onchange = rtl.createSafeCallback(this,"DoAnswerMakeup");
      document.getElementById("seldefinition").onchange = rtl.createSafeCallback(this,"DoDefinition");
      document.getElementById("selcharttext").onchange = rtl.createSafeCallback(this,"DoChartText");
      $mod.GenerateChart();
    };
  });
  this.Activity = "";
  this.Convertimagemax = 33;
  this.Currentcol = 0;
  this.Currentrow = 0;
  this.Givetext = true;
  this.Givevoice = true;
  this.Qorder = "random";
  this.Showdefinition = true;
  this.Showcharttext = true;
  this.Sycount = 0;
  this.Sylist = " a   aa   *     u   uu   e   *    i   ii   (u) h   $" + " wa  *    waa   wu  wuu  *   we   wi  wii  *   *   $" + " pa  paa  pwaa  pu  puu  pe  pwe  pi  pii  p   *   $" + " va  vaa  vwaa  vu  vuu  ve  vwe  vi  vii  v   *   $" + " ta  taa  twaa  tu  tuu  te  twe  ti  tii  t   *   $" + " tha thaa thwaa thu thuu the thwe thi thii th  *   $" + " ka  kaa  kwaa  ku  kuu  ke  kwe  ki  kii  k   kw  $" + " cha chaa chwaa chu chuu che chwe chi chii ch  *   $" + " ma  maa  mwaa  mu  muu  me  mwe  mi  mii  m   mw  $" + " na  naa  nwaa  nu  nuu  ne  nwe  ni  nii  n   *   $" + " la  laa  lwaa  lu  luu  le  lwe  li  lii  l   *   $" + " sa  saa  swaa  su  suu  se  swe  si  sii  s   *   $" + " sha shaa shwaa shu shuu she shwe shi shii sh  *   $" + " ya  yaa  ywaa  yu  yuu  ye  ywe  yi  yii  y   *   $" + " ra  raa  rwaa  ru  ruu  re  rwe  ri  rii  r   *   $";
  this.Sytable = rtl.arraySetLength(null,"",20,20);
  this.Syrowcount = 15;
  this.Sycolcount = 11;
  this.Synames = rtl.arraySetLength(null,"",200);
  this.Syanswer = "";
  this.Sybuttonmode = "";
  this.Wordcount = 0;
  this.Wordlist = "kaakw                porcupine            $" + "aahchikw             seal                 $" + "chiishikw            sky                  $" + "muuhkumaan           knife                $" + "pachuuyaan           shirt                $" + "amiskw               beaver               $" + "waaskaahiikan        house                $" + "waashtenimaakan      lamp                 $" + "niihtaahch           below                $" + "shiipaa              under                $" + "nishtu               three                $" + "mitaaht              ten                  $" + "miskaat              leg                  $" + "niipiish             flower               $" + "taahkaapihchenikan   telephone            $" + "chiichiish           baby                 $" + "shikaakw             skunk                $" + "chiishikaaupiisim    sun                  $" + "tipiskaaupiisim      moon                 $" + "achahkush            star                 $" + "miskut               nose                 $" + "mitihchii            hand                 $" + "mwaakw               loon                 $" + "kaahkaachuu          raven                $" + "paatimaah            soon                 $" + "nisk                 Canada goose         $" + "asaam                snowshoe             $" + "ushkui               birch tree           $";
  this.Wordimagemax = 11;
  this.Wordnames = rtl.arraySetLength(null,"",100);
  this.Worddefs = rtl.arraySetLength(null,"",100);
  this.Wordanswer = "";
  this.Worddefinition = "";
  this.Wordbuttonmode = "";
  this.Wordsycount = 0;
  this.Wordsycountmax = 75;
  this.Wordsy = rtl.arraySetLength(null,"",75);
  this.ParseSyllabicList = function () {
    var colcount = 0;
    var currpos = 0;
    var element = "";
    var elementstart = 0;
    var elementend = 0;
    var foundelementstart = false;
    var foundelementend = false;
    var rowcount = 0;
    var listlength = 0;
    var donelist = false;
    if (pas.SysUtils.RightStr($mod.Sylist,1) !== " ") {
      $mod.Sylist = $mod.Sylist + " ";
    };
    listlength = $mod.Sylist.length;
    $mod.Sycount = 0;
    currpos = 0;
    rowcount = 1;
    colcount = 0;
    donelist = false;
    do {
      foundelementstart = false;
      do {
        currpos = currpos + 1;
        if (currpos > listlength) {
          foundelementstart = true;
          donelist = true;
          continue;
        };
        if (pas.strutils.MidStr($mod.Sylist,currpos,1) !== " ") {
          foundelementstart = true;
        };
      } while (!foundelementstart);
      if (donelist === true) {
        continue;
      };
      elementstart = currpos;
      foundelementend = false;
      do {
        currpos = currpos + 1;
        if (currpos > listlength) {
          elementend = currpos - 1;
          foundelementend = true;
          continue;
        };
        if (pas.strutils.MidStr($mod.Sylist,currpos,1) === " ") {
          elementend = currpos - 1;
          foundelementend = true;
          continue;
        };
      } while (!foundelementend);
      element = pas.strutils.MidStr($mod.Sylist,elementstart,elementend - (elementstart - 1));
      if (element === "$") {
        rowcount = rowcount + 1;
        colcount = 0;
        continue;
      };
      colcount = colcount + 1;
      $mod.Sytable[rowcount - 1][colcount - 1] = element;
      if (element !== "*") {
        $mod.Sycount = $mod.Sycount + 1;
        $mod.Synames[$mod.Sycount - 1] = element;
      };
    } while (!donelist);
    if (element === "$") {
      rowcount = rowcount - 1;
    };
  };
  this.ParseWordList = function () {
    var currpos = 0;
    var dollarpos = 0;
    var donelist = false;
    var listlength = 0;
    var spacepos = 0;
    var thisdef = "";
    var thispair = "";
    var thisword = "";
    currpos = 0;
    dollarpos = 0;
    donelist = false;
    listlength = $mod.Wordlist.length;
    $mod.Wordcount = 0;
    do {
      currpos = dollarpos + 1;
      if (currpos > listlength) {
        donelist = true;
        continue;
      };
      dollarpos = pas.System.Pos("$",pas.SysUtils.RightStr($mod.Wordlist,listlength - (currpos - 1)));
      if (dollarpos === 0) {
        donelist = true;
        continue;
      };
      dollarpos = (currpos - 1) + dollarpos;
      thispair = pas.SysUtils.Trim(pas.strutils.MidStr($mod.Wordlist,currpos,dollarpos - 1 - (currpos - 1)));
      spacepos = pas.System.Pos(" ",thispair);
      if (spacepos === 0) {
        donelist = true;
        continue;
      };
      thisword = pas.SysUtils.LeftStr(thispair,spacepos - 1);
      thisdef = pas.SysUtils.Trim(pas.SysUtils.RightStr(thispair,thispair.length - spacepos));
      $mod.Wordcount = $mod.Wordcount + 1;
      $mod.Wordnames[$mod.Wordcount - 1] = thisword;
      $mod.Worddefs[$mod.Wordcount - 1] = thisdef;
    } while (!donelist);
  };
  this.MakeSyllables = function (s) {
    var Result = "";
    var c = 0;
    var checksy = "";
    var count = 0;
    var done = false;
    var foundsy = false;
    var parsedword = "";
    var processedcount = 0;
    var r = 0;
    var start = 0;
    processedcount = 0;
    parsedword = "";
    done = false;
    do {
      foundsy = false;
      for (var $l = $mod.Sycolcount; $l >= 1; $l--) {
        c = $l;
        for (var $l1 = $mod.Syrowcount; $l1 >= 1; $l1--) {
          r = $l1;
          checksy = $mod.Sytable[r - 1][c - 1];
          count = checksy.length;
          start = (s.length - (processedcount + count)) + 1;
          if (pas.strutils.MidStr(s,start,count) === checksy) {
            foundsy = true;
            if (processedcount > 0) {
              checksy = checksy + "-";
            };
            parsedword = checksy + parsedword;
            processedcount = processedcount + count;
            break;
          };
        };
        if (foundsy === true) {
          break;
        };
      };
      var $tmp = foundsy;
      if ($tmp === false) {
        parsedword = "*";
        done = true;
      } else if ($tmp === true) {
        if (processedcount === s.length) {
          done = true;
        };
      };
    } while (!done);
    Result = parsedword;
    return Result;
  };
  this.TweakSyllables = function (s) {
    var dashpos = 0;
    var done = false;
    var t = "";
    $mod.Wordsycount = 0;
    if (s === "*") {
      return;
    };
    if (pas.SysUtils.RightStr(s,2) === "-u") {
      t = pas.SysUtils.LeftStr(s,s.length - 1) + "(u)-";
    } else {
      t = s + "-";
    };
    done = false;
    do {
      if (t === "") {
        done = true;
        continue;
      };
      dashpos = pas.System.Pos("-",t);
      if (dashpos === 0) {
        done = true;
        continue;
      };
      if ($mod.Wordsycount === $mod.Wordsycountmax) {
        done = true;
        continue;
      };
      $mod.Wordsycount = $mod.Wordsycount + 1;
      $mod.Wordsy[$mod.Wordsycount - 1] = pas.SysUtils.LeftStr(t,dashpos - 1);
      t = pas.SysUtils.RightStr(t,t.length - dashpos);
    } while (!done);
  };
  this.DisplayWordTestSyllabics = function (w) {
    var fname = "";
    var i = 0;
    var s = "";
    var ws = "";
    ws = $mod.MakeSyllables(w);
    $mod.TweakSyllables(ws);
    if ($mod.Wordsycount === 0) {
      return;
    };
    for (var $l = 1, $end = $mod.Wordsycount; $l <= $end; $l++) {
      i = $l;
      if (i >= $mod.Wordimagemax) {
        break;
      };
      s = "" + i;
      fname = "syimages\/sy_" + $mod.Wordsy[i - 1] + ".svg";
      document.getElementById("wordimage" + s).setAttribute("src",fname);
    };
    for (var $l1 = $mod.Wordsycount + 1, $end1 = $mod.Wordimagemax; $l1 <= $end1; $l1++) {
      i = $l1;
      s = "" + i;
      fname = "syimages\/_blank.svg";
      document.getElementById("wordimage" + s).setAttribute("src",fname);
    };
  };
  this.DisplayChart = function () {
    var c = 0;
    var cs = "";
    var fname = "";
    var r = 0;
    var rs = "";
    var sythis = "";
    for (var $l = 1, $end = $mod.Syrowcount; $l <= $end; $l++) {
      r = $l;
      rs = "" + r;
      if (r < 10) {
        rs = "0" + rs;
      };
      for (var $l1 = 1, $end1 = $mod.Sycolcount; $l1 <= $end1; $l1++) {
        c = $l1;
        cs = "" + c;
        if (c < 10) {
          cs = "0" + cs;
        };
        sythis = $mod.Sytable[r - 1][c - 1];
        if (sythis === "*") {
          sythis = "&nbsp;";
          fname = "syimages\/_blank.svg";
        } else {
          fname = "syimages\/sy_" + sythis + ".svg";
        };
        document.getElementById("r" + rs + "c" + cs).setAttribute("src",fname);
        if ((r === 1) && (c === 10)) {
          sythis = "u";
        };
        document.getElementById("fr" + rs + "c" + cs).innerHTML = sythis;
      };
    };
  };
  this.ToggleChartText = function () {
    var c = 0;
    var cs = "";
    var r = 0;
    var rs = "";
    var sythis = "";
    for (var $l = 1, $end = $mod.Syrowcount; $l <= $end; $l++) {
      r = $l;
      rs = "" + r;
      if (r < 10) {
        rs = "0" + rs;
      };
      for (var $l1 = 1, $end1 = $mod.Sycolcount; $l1 <= $end1; $l1++) {
        c = $l1;
        cs = "" + c;
        if (c < 10) {
          cs = "0" + cs;
        };
        var $tmp = $mod.Showcharttext;
        if ($tmp === true) {
          sythis = $mod.Sytable[r - 1][c - 1];
          if (sythis === "*") {
            sythis = "&nbsp;";
          };
          if ((r === 1) && (c === 10)) {
            sythis = "u";
          };
        } else if ($tmp === false) {
          sythis = "&nbsp;";
        };
        document.getElementById("fr" + rs + "c" + cs).innerHTML = sythis;
      };
    };
  };
  this.GenerateChart = function () {
    var brelem = null;
    var capelem = null;
    var divelem = null;
    var figelem = null;
    var imgelem = null;
    var c = 0;
    var cs = "";
    var r = 0;
    var rs = "";
    divelem = document.getElementById("divchartimages");
    brelem = document.createElement("br");
    for (var $l = 1, $end = $mod.Syrowcount; $l <= $end; $l++) {
      r = $l;
      rs = "" + r;
      if (r < 10) {
        rs = "0" + rs;
      };
      for (var $l1 = 1, $end1 = $mod.Sycolcount; $l1 <= $end1; $l1++) {
        c = $l1;
        cs = "" + c;
        if (c < 10) {
          cs = "0" + cs;
        };
        figelem = document.createElement("figure");
        divelem.appendChild(figelem);
        imgelem = document.createElement("img");
        capelem = document.createElement("figcaption");
        figelem.appendChild(imgelem);
        figelem.appendChild(capelem);
        imgelem.setAttribute("id","r" + rs + "c" + cs);
        imgelem.setAttribute("src","syimages\/_blank.svg");
        imgelem.setAttribute("width","40");
        imgelem.setAttribute("height","40");
        capelem.setAttribute("id","f" + "r" + rs + "c" + cs);
        capelem.innerHTML = "&nbsp;";
      };
      brelem = document.createElement("br");
      divelem.appendChild(brelem);
    };
  };
  $mod.$main = function () {
    $mod.Activity = "welcome";
    $mod.Sybuttonmode = "next";
    $mod.Syanswer = "";
    $mod.Wordbuttonmode = "next";
    $mod.Wordanswer = "";
    $mod.Worddefinition = "";
    $mod.ParseSyllabicList();
    $mod.ParseWordList();
    var $with = $mod.TSlabixApp.$create("Create");
    $with.Run();
  };
});
