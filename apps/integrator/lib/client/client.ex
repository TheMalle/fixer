defmodule Integrator.Client do
  @moduledoc false

  @behaviour AdapterHandler.Adapter
  
  alias Integrator.Client.Adapters

  @adapters %{
    discord: Adapters.Discord
  }

  @impl AdapterHandler.Adapter
  def child_spec(spec), do: AdapterHandler.child_spec(spec, @adapters)
end
