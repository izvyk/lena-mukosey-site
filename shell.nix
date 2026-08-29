{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  packages = with pkgs; [
    nodejs_24
    # json-language-server
    vtsls
    eslint
    tailwindcss-language-server

    nil
    nixd
    package-version-server
  ];
}
