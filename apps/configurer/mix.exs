defmodule Configurer.MixProject do
  use Mix.Project

  def project do
    [
      app: :configurer,
      version: "0.1.0",
      build_path: "../../_build",
      config_path: "../../config/config.exs",
      deps_path: "../../deps",
      lockfile: "../../mix.lock",
      elixir: "~> 1.10",
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  def application do
    [
      extra_applications: [:logger],
      mod: {Configurer, []}
    ]
  end

  defp deps do
    [
      {:jason, "~> 1.0"}
    ]
  end
end
