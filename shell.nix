let

  pkgs = import ./nix;

  elixir = pkgs.beam.packages.erlangR22.elixir_1_9;

  inherit (pkgs) lib stdenv;
  inherit (lib) optional;
in

pkgs.mkShell {

  buildInputs = with pkgs; [
    elixir
    git
  ]
  ++ optional stdenv.isLinux glibcLocales # To allow setting consistent locale on Linux
  ++ optional stdenv.isLinux inotify-tools # For file_system
  ++ optional stdenv.isLinux libnotify # For ExUnit
  ;

  # Keep project-specific shell commands local
  HISTFILE = "${toString ./.}/.bash_history";

  ####################################################################
  # Without  this, almost  everything  fails with  locale issues  when
  # using `nix-shell --pure` (at least on NixOS).
  # See
  # + https://github.com/NixOS/nix/issues/318#issuecomment-52986702
  # + http://lists.linuxfromscratch.org/pipermail/lfs-support/2004-June/023900.html
  ####################################################################

  LOCALE_ARCHIVE = if stdenv.isLinux then "${pkgs.glibcLocales}/lib/locale/locale-archive" else "";
  LANG = "en_US.UTF-8";
}
