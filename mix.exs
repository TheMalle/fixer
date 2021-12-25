defmodule Fixer.MixProject do
  use Mix.Project

  def project do
    [
      app: :fixer,
      version: "0.1.0",
      elixir: "~> 1.12",
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  def application do
    [
      extra_applications: [:logger],
      mod: {Fixer.Application, []}
    ]
  end

  defp deps do
    [
      {:map_diff, "~> 1.3"},
      {:nostrum, github: "Kraigie/nostrum"}
    ]
  end
end
