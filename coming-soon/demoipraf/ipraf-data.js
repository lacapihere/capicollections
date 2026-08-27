/* ============================================================================
 * IPRAF · Capa de datos del usuario
 *
 * Una sola interfaz — IPRAF.auth e IPRAF.progress — con dos implementaciones
 * detrás:
 *
 *   · Supabase, cuando window.IPRAF_CONFIG trae url y anonKey.
 *   · Local (localStorage), en cualquier otro caso.
 *
 * Ambas exponen exactamente los mismos métodos y devuelven las mismas formas,
 * así que la interfaz no sabe cuál está activa. Cambiar de una a otra es
 * rellenar dos valores de configuración, no reescribir pantallas.
 *
 * El esquema de la base vive en db/001_progress.sql.
 * ========================================================================== */
(function (global) {
  "use strict";

  var CFG = global.IPRAF_CONFIG || {};
  var USA_SUPABASE = !!(CFG.url && CFG.anonKey && global.supabase);

  /* ------------------------------------------------------------------ util */
  function ahora() { return new Date().toISOString(); }

  function claveCaso(materia, n) { return materia + ":" + n; }

  // Los verdictos que cuentan como fallo para la tasa de error.
  var FALLO = { falle: 1, parcial: 1 };

  /* ==========================================================================
   * Implementación LOCAL
   * ========================================================================== */
  var Local = (function () {
    var K_SESION = "ipraf.sesion";
    var K_ESTADO = "ipraf.estado";

    function leer(clave, porDefecto) {
      try {
        var raw = global.localStorage.getItem(clave);
        return raw ? JSON.parse(raw) : porDefecto;
      } catch (e) {
        // Ventana privada, almacenamiento bloqueado o cuota llena: se sigue
        // funcionando en memoria durante la sesión en vez de romper la app.
        return porDefecto;
      }
    }
    function escribir(clave, valor) {
      try { global.localStorage.setItem(clave, JSON.stringify(valor)); }
      catch (e) { /* sin persistencia; la sesión sigue viva en memoria */ }
    }

    function estado() {
      return leer(K_ESTADO, { casos: {}, unidades: {}, ensayo: [] });
    }

    return {
      modo: "local",

      /* ---- sesión ---- */
      sesion: function () { return leer(K_SESION, null); },

      // El segundo argumento (password) solo existe para igualar la firma
      // de Remoto.entrar — modo local no verifica contraseña y NUNCA debe
      // guardarla ni usarla como nombre para mostrar.
      entrar: function (email, password) {
        var s = {
          id: "local-" + (email || "invitado"),
          email: email || "invitado@ipraf.local",
          nombre: email ? email.split("@")[0] : "Invitado",
          plan: "premium"
        };
        escribir(K_SESION, s);
        return Promise.resolve(s);
      },

      salir: function () {
        try { global.localStorage.removeItem(K_SESION); } catch (e) {}
        return Promise.resolve();
      },

      /* ---- eventos ---- */
      marcarCaso: function (materia, n, campos) {
        var st = estado();
        var k = claveCaso(materia, n);
        st.casos[k] = Object.assign(
          { materia: materia, n: n, creado: ahora() },
          st.casos[k] || {},
          campos,
          { actualizado: ahora() }
        );
        escribir(K_ESTADO, st);
        return Promise.resolve(st.casos[k]);
      },

      marcarUnidad: function (materia, n, campos) {
        var st = estado();
        var k = claveCaso(materia, n);
        st.unidades[k] = Object.assign(
          { materia: materia, n: n, creado: ahora() },
          st.unidades[k] || {},
          campos,
          { actualizado: ahora() }
        );
        escribir(K_ESTADO, st);
        return Promise.resolve(st.unidades[k]);
      },

      registrarConteo: function (escenario, comprometido, real) {
        var st = estado();
        st.ensayo.push({
          escenario: escenario,
          comprometido: comprometido,
          real: real,
          creado: ahora()
        });
        escribir(K_ESTADO, st);
        return Promise.resolve();
      },

      /* ---- lectura ---- */
      estadoCaso: function (materia, n) {
        return estado().casos[claveCaso(materia, n)] || null;
      },
      estadoUnidad: function (materia, n) {
        return estado().unidades[claveCaso(materia, n)] || null;
      },

      resumen: function () {
        var st = estado();
        var casos = Object.keys(st.casos).map(function (k) { return st.casos[k]; });
        var unidades = Object.keys(st.unidades).map(function (k) { return st.unidades[k]; });

        var porMateria = {}, porArquetipo = {}, porFamilia = {};

        casos.forEach(function (c) {
          if (c.visto) {
            var m = porMateria[c.materia] || (porMateria[c.materia] = { vistos: 0, respondidos: 0, aciertos: 0 });
            m.vistos++;
            if (c.familia) {
              var kf = c.materia + "/" + c.familia;
              porFamilia[kf] = (porFamilia[kf] || 0) + 1;
            }
          }
          if (c.verdicto) {
            var mm = porMateria[c.materia] || (porMateria[c.materia] = { vistos: 0, respondidos: 0, aciertos: 0 });
            mm.respondidos++;
            if (c.verdicto === "acerte") mm.aciertos++;

            if (c.arquetipo) {
              var a = porArquetipo[c.arquetipo] ||
                      (porArquetipo[c.arquetipo] = { respondidos: 0, fallos: 0, tasaError: 0 });
              a.respondidos++;
              if (FALLO[c.verdicto]) a.fallos++;
              a.tasaError = Math.round(100 * a.fallos / a.respondidos);
            }
          }
        });

        var brechas = st.ensayo.map(function (e) { return e.real - e.comprometido; });
        var media = brechas.length
          ? Math.round(10 * brechas.reduce(function (x, y) { return x + y; }, 0) / brechas.length) / 10
          : null;

        return Promise.resolve({
          casosVistos: casos.filter(function (c) { return c.visto; }).length,
          unidadesLeidas: unidades.filter(function (u) { return u.leida; }).length,
          marcados: casos.filter(function (c) { return c.marcado; }).length,
          porMateria: porMateria,
          porArquetipo: porArquetipo,
          porFamilia: porFamilia,
          ensayo: {
            intentos: brechas.length,
            brechaMedia: media,
            ultimaBrecha: brechas.length ? brechas[brechas.length - 1] : null
          }
        });
      }
    };
  })();

  /* ==========================================================================
   * Implementación SUPABASE
   * Mismos métodos, mismas formas de retorno.
   * ========================================================================== */
  var Remoto = (function () {
    if (!USA_SUPABASE) return null;
    var db = global.supabase.createClient(CFG.url, CFG.anonKey);
    var cache = null;

    function uid() { return cache && cache.id; }

    return {
      modo: "supabase",
      cliente: db,

      sesion: function () { return cache; },

      // Se llama una vez al arrancar para recuperar la sesión persistida.
      iniciar: function () {
        return db.auth.getSession().then(function (r) {
          var s = r.data && r.data.session;
          if (!s) { cache = null; return null; }
          return db.from("profiles").select("full_name,email").eq("id", s.user.id).single()
            .then(function (p) {
              return db.from("entitlements").select("plan,status").eq("user_id", s.user.id).single()
                .then(function (e) {
                  cache = {
                    id: s.user.id,
                    email: (p.data && p.data.email) || s.user.email,
                    nombre: (p.data && p.data.full_name) || s.user.email.split("@")[0],
                    plan: (e.data && e.data.plan) || "free"
                  };
                  return cache;
                });
            });
        });
      },

      entrar: function (email, password) {
        return db.auth.signInWithPassword({ email: email, password: password })
          .then(function (r) {
            if (r.error) throw r.error;
            return Remoto.iniciar();
          });
      },

      entrarConProveedor: function (proveedor) {
        return db.auth.signInWithOAuth({
          provider: proveedor,
          options: { redirectTo: global.location.origin + global.location.pathname }
        });
      },

      salir: function () {
        return db.auth.signOut().then(function () { cache = null; });
      },

      marcarCaso: function (materia, n, campos) {
        if (!uid()) return Promise.resolve(null);
        var fila = {
          user_id: uid(), subject_slug: materia, case_number: n,
          updated_at: ahora()
        };
        if ("visto" in campos)      fila.seen_at = campos.visto ? ahora() : null;
        if ("respuesta" in campos)  fila.committed_answer = campos.respuesta;
        if ("verdicto" in campos)   fila.self_verdict = campos.verdicto;
        if ("confianza" in campos)  fila.confidence = campos.confianza;
        if ("marcado" in campos)    fila.flagged = campos.marcado;
        if ("arquetipo" in campos)  fila.archetype = campos.arquetipo;
        if ("familia" in campos)    fila.family = campos.familia;
        return db.from("case_states")
          .upsert(fila, { onConflict: "user_id,subject_slug,case_number" })
          .then(function (r) { if (r.error) throw r.error; return r.data; });
      },

      marcarUnidad: function (materia, n, campos) {
        if (!uid()) return Promise.resolve(null);
        var fila = {
          user_id: uid(), subject_slug: materia, unit_number: n, updated_at: ahora()
        };
        if ("leida" in campos)     fila.read_at = campos.leida ? ahora() : null;
        if ("dominio" in campos)   fila.mastery = campos.dominio;
        if ("notas" in campos)     fila.notes = campos.notas;
        if ("arquetipo" in campos) fila.archetype = campos.arquetipo;
        return db.from("unit_states")
          .upsert(fila, { onConflict: "user_id,subject_slug,unit_number" })
          .then(function (r) { if (r.error) throw r.error; return r.data; });
      },

      registrarConteo: function (escenario, comprometido, real) {
        if (!uid()) return Promise.resolve();
        return db.from("essay_attempts").insert({
          user_id: uid(), scenario_id: escenario,
          guessed_count: comprometido, actual_count: real
        }).then(function (r) { if (r.error) throw r.error; });
      },

      estadoCaso: function () { return null; },   // se hidrata por lote, ver hidratar()
      estadoUnidad: function () { return null; },

      // Una sola llamada trae todo el resumen; la agregación ocurre en Postgres.
      resumen: function () {
        if (!uid()) return Promise.resolve(null);
        return db.rpc("progress_summary").then(function (r) {
          if (r.error) throw r.error;
          var d = r.data || {};
          return {
            casosVistos:    d.cases_seen || 0,
            unidadesLeidas: d.units_read || 0,
            marcados:       d.flagged || 0,
            porMateria:     d.by_subject || {},
            porArquetipo:   d.by_archetype || {},
            porFamilia:     d.by_family || {},
            ensayo: {
              intentos:     (d.essay && d.essay.attempts) || 0,
              brechaMedia:  (d.essay && d.essay.avg_gap) || null,
              ultimaBrecha: (d.essay && d.essay.last_gap) || null
            }
          };
        });
      }
    };
  })();

  /* ==========================================================================
   * Interfaz pública
   * ========================================================================== */
  var impl = Remoto || Local;

  global.IPRAF_USER = {
    modo: impl.modo,

    auth: {
      sesion: function () { return impl.sesion(); },
      iniciar: function () { return impl.iniciar ? impl.iniciar() : Promise.resolve(impl.sesion()); },
      entrar: function (a, b) { return impl.entrar(a, b); },
      entrarConProveedor: function (p) {
        return impl.entrarConProveedor
          ? impl.entrarConProveedor(p)
          : impl.entrar(p + "@ipraf.local");     // en modo local, un alta simulada
      },
      salir: function () { return impl.salir(); }
    },

    progress: {
      /* Eventos. Todos aceptan el arquetipo y la familia para que la
         agregación por tipo de fricción no necesite releer el contenido. */
      verCaso: function (materia, n, meta) {
        return impl.marcarCaso(materia, n, Object.assign({ visto: true }, meta || {}));
      },
      responderCaso: function (materia, n, respuesta, verdicto, meta) {
        return impl.marcarCaso(materia, n, Object.assign(
          { visto: true, respuesta: respuesta, verdicto: verdicto }, meta || {}));
      },
      marcarCaso: function (materia, n, marcado) {
        return impl.marcarCaso(materia, n, { marcado: !!marcado });
      },
      leerUnidad: function (materia, n, meta) {
        return impl.marcarUnidad(materia, n, Object.assign({ leida: true }, meta || {}));
      },
      registrarConteo: function (escenario, comprometido, real) {
        return impl.registrarConteo(escenario, comprometido, real);
      },

      /* Lectura */
      estadoCaso:   function (m, n) { return impl.estadoCaso(m, n); },
      estadoUnidad: function (m, n) { return impl.estadoUnidad(m, n); },
      resumen:      function () { return impl.resumen(); }
    }
  };
})(window);
