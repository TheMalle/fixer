defmodule Configurer do
  @moduledoc """
  Documentation for `Configurer`.
  """

  require Logger
  
  use Application

  @doc false
  def start(_type, _args) do
    children = []

    {:ok, _} = Application.ensure_all_started(:jason)

    folder = Application.fetch_env!(:configurer, :folder)
    files = File.ls!(folder)

    files
    |> Enum.reduce([], &parse(folder, &1, &2))
    |> Enum.reject(&(&1 == []))
    |> Application.put_all_env()

    opts = [strategy: :one_for_one, name: Configurer.Supervisor]
    Supervisor.start_link(children, opts)
  end

  defp parse(folder, file, acc) do
    ext = Path.extname(file)
    filepath = Path.join(folder, file)
    
    case ext do
      ".exs" ->
        acc ++ Config.Reader.read!(filepath)
      _ ->
        Logger.warn("ignoring configuration file #{inspect(filepath)}")
        acc
    end
  end
end
