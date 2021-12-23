# Fixer
Dice rolling discord bot with parsing of chummer5 save files

## Getting Started

### Requirements

- Elixir 1.12+
- Erlang R24+

### Development environment

This project uses [Nix](https://nixos.org/nix) to provide a
reproducible development environment. Having installed Nix, run
`nix-shell` in the root of the repository to set up an isolated shell
with the development environment. This ensures consistent environments
for all developers, both when developing and testing.

The environment is locked to a specific version. To update it, run:

```
    $ sh ./nix/update-nixpkgs.sh
```

When complete, start a new `nix-shell`.

### Development

#### Dependencies

```
    $ mix deps.get
```

#### Local execution

```
    $ iex -S mix
```

#### Formatting

```
    $ mix format
```

### Testing

```
    $ mix test
```

### Release

First, ensure all requisite environment variables used in
`config/releases.exs` are set. Then, run:

```
    $ MIX_ENV=prod mix deps.get
    $ MIX_ENV=prod mix release
```

