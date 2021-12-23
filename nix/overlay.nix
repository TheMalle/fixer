self: super: {

  erlang = super.erlangR24;
  elixir = super.beam.packages.erlangR24.elixir_1_12;

  # Ensure all packages uses the same pinned erlang version
  beam = super.beam // rec {
    packages = super.beam.packages // rec {
      erlang = (super.beam.packagesWith self.erlang);
    };
  };

  hex-archive = super.stdenv.mkDerivation rec {
    pname = "hex";
    version = "1.0.1";

    src = super.fetchFromGitHub {
      owner = "hexpm";
      repo = "hex";
      rev = "v${version}";
      sha256 = "1i7lv84mz1v9kpv3v8hw8kvxiybq35s0d3djsx68a0nv1nk9znwr";
    };

    setupHook = super.writeText "setupHook.sh" ''
      addToSearchPath ERL_LIBS "$1/lib/erlang/lib/"
    '';

    dontStrip = true;

    buildInputs = [ self.elixir ];

    LANG = "C.UTF-8";

    buildPhase = ''
      export HEX_OFFLINE=1
      export MIX_HOME=./
      MIX_ENV=prod mix compile --no-deps-check
      MIX_ENV=prod mix archive.build --no-deps-check
      MIX_ENV=prod mix archive.build --no-deps-check -o hex.ez
    '';

    installPhase = ''
      mkdir $out
      cp hex.ez $out/hex.ez
    '';

  };
}
