var Rt = Op.runtime = {};

/**
 * Useful js methods used within runtime.
 */
var ArrayProto     = Array.prototype,
    ObjectProto    = Object.prototype,
    ArraySlice     = ArrayProto.slice,
    hasOwnProperty = ObjectProto.hasOwnProperty;

/**
 *  Core runtime classes, objects and literals.
 */
var rb_cBasicObject,  rb_cObject,       rb_cModule,       rb_cClass,
    rb_cNativeObject, rb_mKernel,       rb_cNilClass,     rb_cBoolean,
    rb_cArray,        rb_cNumeric,      rb_cString,       rb_cHash,
    rb_cRegexp,       rb_cMatch,        rb_top_self,      Qnil,
    rb_cDir,          rb_cProc,         rb_cRange;

/**
 *  Exception classes. Some of these are used by runtime so they are here for
 * convenience.
 */
var rb_eException,       rb_eStandardError,   rb_eLocalJumpError,  rb_eNameError,
    rb_eNoMethodError,   rb_eArgError,        rb_eScriptError,     rb_eLoadError,
    rb_eRuntimeError,    rb_eTypeError,       rb_eIndexError,      rb_eKeyError,
    rb_eRangeError,      rb_eNotImplementedError;

/**
 *  Standard jump exceptions to save re-creating them everytime they are needed
 */
var rb_eReturnInstance,
    rb_eBreakInstance,
    rb_eNextInstance;

/**
 * Core object type flags. Added as local variables, and onto runtime.
 */
var T_CLASS       = 0x0001,
    T_MODULE      = 0x0002,
    T_OBJECT      = 0x0004,
    T_BOOLEAN     = 0x0008,
    T_STRING      = 0x0010,
    T_ARRAY       = 0x0020,
    T_NUMBER      = 0x0040,
    T_PROC        = 0x0080,
    //T_SYMBOL      = 0x0100,   -- depreceated - no more symbol class!
    T_HASH        = 0x0200,
    T_RANGE       = 0x0400,
    T_ICLASS      = 0x0800,
    FL_SINGLETON  = 0x1000;

/**
 * Interns used within runtime.
 */
var id_new,       // new
    id_inherited, // inherited
    id_to_s,      // to_s
    id_require;   // require

/**
  Every object has a unique id. This count is used as the next id for the
  next created object. Therefore, first ruby object has id 0, next has 1 etc.
*/
var rb_hash_yield = 0;

function rb_attr(klass, name, reader, writer) {
  var ivar = rb_ivar_intern('@' + name);

  if (reader) {
    rb_define_method(klass, name, function(self) {
      return self[ivar];
    });
  }
  if (writer) {
    rb_define_method(klass, name + '=', function(self, val) {
      return self[ivar] = val;
    });
  }
}

/**
  Define methods. Public method for defining a method on the given base.

  The given name here will be the real string name, not a ruby id.

  @param {Object} klass The base to define method on
  @param {String} name Ruby mid
  @param {Function} body The method implementation
  @return {Qnil}
*/
function rb_define_method(klass, name, body) {
  if (klass.$f & T_OBJECT) {
    klass = klass.$k;
  }

  if (!body.$rbName) {
    body.$rbKlass = klass;
    body.$rbName = name;
  }

  var id = rb_intern(name);

  rb_define_raw_method(klass, id, body);
  klass.$methods.push(name);

  return Qnil;
};

/**
  Actually find super impl to call.  Returns null if cannot find it.
*/
function rb_super_find(klass, callee, mid) {
  var cur_method;

  while (klass) {
    if (klass.$method_table[mid]) {
      if (klass.$method_table[mid] == callee) {
        cur_method = klass.$method_table[mid];
        break;
      }
    }
    klass = klass.o$s;
  }

  if (!(klass && cur_method)) { return null; }

  klass = klass.o$s;

  while (klass) {
    if (klass.$method_table[mid]) {
      return klass.$method_table[mid];
    }

    klass = klass.o$s;
  }

  return null;
};


/**
  Ruby return, with the given value. The func is the reference function which
  represents the method that this statement must return from.
*/
Rt.R = function(value, func) {
  rb_eReturnInstance.$value = value;
  rb_eReturnInstance.$func = func;
  throw rb_eReturnInstance;
};

/**
  Get the given constant name from the given base
*/
Rt.cg = function(base, id) {
  if (base == null) {
    base = rb_cNilClass;
  }
  else if (base.$f & T_OBJECT) {
    base = rb_class_real(base.$k);
  }
  return rb_const_get(base, id);
};

/**
  Set constant from runtime
*/
Rt.cs = function(base, id, val) {
  if (base.$f & T_OBJECT) {
    base = rb_class_real(base.$k);
  }
  return rb_const_set(base, id, val);
};

/**
  Class variables table
*/
var rb_class_variables = {};

Rt.cvg = function(id) {
  var v = rb_class_variables[id];

  if (v) return v;

  return Qnil;
};

Rt.cvs = function(id, val) {
  return rb_class_variables[id] = val;
};

/**
 * An array of procs to call for at_exit()
 *
 * @param {Function} proc implementation
 */
var rb_end_procs = [];

/**
  Called upon exit: we need to run all of our registered procs
  in reverse order: i.e. call last ones first.

  FIXME: do we need to try/catch this??
*/
Rt.do_at_exit = function() {
  var proc;

  while (proc = rb_end_procs.pop()) {
    proc(proc.$S);
  }

  return null;
};

