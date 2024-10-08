import passport from "passport";
import local from "passport-local";
import github from "passport-github2";
import passportJWT from "passport-jwt";
import { hashing, validarPasword } from "../utils.js";
import { config } from "./config.js";
import { UsuarioDao } from "../dao/Usuario.dao.js";
import { usuarioService } from "../service/Usuarios.service.js";
import { cartService } from "../service/Cart.services.js";
import { UsuariosDTO } from "./DTO/usuariosDTO.js";



const searchToken = (req) => {
  let token = null;
  if (req.cookies && req.cookies.cookieMica) {
    token = req.cookies.cookieMica;
  }
  return token;
};

export const initPassport = () => {
  passport.use(
    "registro",
    new local.Strategy(
      { usernameField: "email", passReqToCallback: true },
      async (req, username, password, done) => {
        try {
          let { first_name, last_name, age} = req.body;
          if (!first_name || !last_name || !age) {
            console.log("completa los datos");
            return done(null, false);
          }
          let existe = await usuarioService.getUserByEmail(username);
          if (existe) {
            console.log("El usuario ya existe");
            return done(null, false);
          }
            // Asignar rol de administrador si el correo coincide
            let role = (username === 'adminCoder@coder.com') ? 'admin' : 'user';
            let newCart= await cartService.createCart()
          let newUser = await usuarioService.create({
            first_name,
            last_name,
            age,
            cart:newCart._id,
            email: username,
            password: hashing(password),
            role
          });
          return done(null, newUser);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.use(
    "login",
    new local.Strategy(
      { usernameField: "email" },
      async (username, password, done) => {
        try {
          let usuario = await usuarioService.getUserByEmail(username);

          if (!usuario || !usuario.password) {
            console.log("No existe el usuario o la contraseña es inválida.");
            return done(null, false);
          }
          if (!validarPasword(password, usuario.password)) {
            console.log("Las credenciales incorrectas");
            return done(null, false);
          }
       
          delete usuario.password;
          return done(null, usuario);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.use(
    "github",
    new github.Strategy(
      {
        clientID: "Iv23liRfoYfwkSilG7hk",
        clientSecret: "4e25d0a74977460b9b43b413f3a99bd72779a209",
        callbackURL: "http://localhost:3000/api/session/callback",
        scope: ["user:email"],
      },
      async (token, refreshtoken, profile, done) => {
        try {
          let email =
            profile.emails && profile.emails[0] && profile.emails[0].value;
          let { name } = profile._json;
          if (!email) { 
            console.log("falta email");
            return done(null, false);
          }
          let usuario = await usuarioService.getUserByEmail(email);
          if (!usuario) {
            console.log("no existe usuario");
            usuario = await usuarioService.create({
              first_name: name,
              email,
              profile,
            });
          }
          return done(null, usuario);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.use(
    "current",
    new passportJWT.Strategy(
      {
        secretOrKey: config.SECRET,
        jwtFromRequest: new passportJWT.ExtractJwt.fromExtractors([
          searchToken
        ]),
      },
      async (contenidoToken, done) => {
        try {
          const usuario=await usuarioService.getUserById(contenidoToken.id)
          if(!usuario){
            return done (null,false)
          }
          const usuarioDTO = new UsuariosDTO(usuario);
          return done(null, usuarioDTO);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser(function (user, done) {
    return done(null, user._id);
})

passport.deserializeUser(async function(id, done) {
    let usuario=await usuarioService.getUserByEmail(id)
    console.log("Usuario deserializado:", usuario); // Verifica qué campos tiene el usuario
    const usuarioDTO = new UsuariosDTO(usuario);
    return done(null, usuarioDTO);
})

};