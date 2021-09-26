# Configurer

Reads application runtime configuration from files in a configuration folder.

## Installation

If [available in Hex](https://hex.pm/docs/publish), the package can be installed
by adding `configurer` to your list of dependencies in `mix.exs`:

```elixir
def deps do
  [
    {:configurer, "~> 0.1.0"}
  ]
end
```

If using within the same umbrella app, instead add
```elixir
def deps do
  [
    {:configurer, in_umbrella: true}
  ]
end
```

Documentation can be generated with [ExDoc](https://github.com/elixir-lang/ex_doc)
and published on [HexDocs](https://hexdocs.pm). Once published, the docs can
be found at [https://hexdocs.pm/configurer](https://hexdocs.pm/configurer).

