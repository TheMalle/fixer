defmodule Integrator.Client.Adapters.Discord do
  @moduledoc false

  @behaviour AdapterHandler.Adapter
  @behaviour Integrator.Client.Adapter
  
  alias Integrator.Client.Adapters.Discord.Adapters

  @adapters %{
    nostrum: Adapters.Nostrum
  }

  @impl AdapterHandler.Adapter
  def child_spec(spec), do: AdapterHandler.child_spec(spec, @adapters)

end
