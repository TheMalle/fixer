let

  pkgs = import ./nix;

  inherit (pkgs) lib stdenv;
  inherit (lib) optional;
in
pkgs.mkShell {

  buildInputs = with pkgs; [
    elixir
    git
    nix-prefetch-git
  ]
  ++ optional stdenv.isLinux glibcLocales # To allow setting consistent locale on Linux
  ++ optional stdenv.isLinux inotify-tools # For file_system
  ++ optional stdenv.isLinux libnotify # For ExUnit
  ;

  # Keep project-specific shell commands local
  HISTFILE = "${toString ./.}/.bash_history";

  LANG = "C.UTF-8";
  LC_ALL = "C.UTF-8";

  shellHook = ''
    mkdir -p .mix
    mkdir -p .hex

    export MIX_HOME=$PWD/.mix
    export MIX_ARCHIVES=$MIX_HOME/archives
    export HEX_HOME=$PWD/.hex
    export PATH=$MIX_HOME/bin:$HEX_HOME/bin:$PATH

    mix archive.install --force ${pkgs.hex-archive}/hex.ez
    mix local.rebar rebar --force ${pkgs.rebar}/bin/rebar
    mix local.rebar rebar3 --force ${pkgs.rebar3}/bin/rebar3

    # History in iex
    export ERL_AFLAGS="-kernel shell_history enabled"
  '';

}
