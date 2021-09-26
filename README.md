# FixerEx

### Reproducible environment

For reproducibility this project uses the [Nix](https://nixos.org/nix) tool.
With Nix installed simply run `nix-shell` in the cloned repository and Nix will
provide a shell with a development environment (without affecting the rest of the
system). This ensures that all developers (and bots) have the same environments
when developing and testing.

To update the locked version of the environment run:

```
    $ sh ./nix/update-nixpkgs.sh
```

and enter a new `nix-shell`.

### Development

#### Fetch dependencies

```
    $ mix deps.get
```

#### Starting the application

To start the application, simply run:

```
    $ mix run
```

To start the application with an interactive shell, run:

```
    $ iex -S mix
```

#### Formatting

This project uses format mix tasks built into Elixir to ensure that the code
format is consistent across all files.

- Check whether files are correctly formatted: `mix format --check-formatted`
- Automatically format files: `mix format`

### Testing

Note that dependencies must have been fetched (as described in
[Development](#fetch-dependencies)) before running tests.

```
    $ mix test
```

### Release

To create a release, run:

```
    $ MIX_ENV=prod mix deps.get
    $ MIX_ENV=prod mix release
```

When starting a release, ensure you have provided all required environment  variables
described in `config/releases.exs` and that you provide any additional runtime
configuration in the specified configuration folder.
