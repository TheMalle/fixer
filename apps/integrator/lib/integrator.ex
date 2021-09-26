defmodule Integrator do
  @moduledoc """
  Documentation for Integrator.
  """

  require Logger
  
  use Application
  
  alias Integrator.Client
  
  @doc false
  def start(_type, _args) do
    {:ok, _} = Application.ensure_all_started(:configurer)
    
    children = Application.get_env(:integrator, :clients, [])
    |> IO.inspect(label: "child specs")
    |> Enum.flat_map(&Client.child_spec(&1))

    if children == [] do
      Logger.warn("No integrator client specifications found")
    end
    
    opts = [strategy: :one_for_one, name: Integrator.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
