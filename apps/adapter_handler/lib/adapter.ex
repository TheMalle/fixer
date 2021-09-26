defmodule AdapterHandler.Adapter do
  @moduledoc false

  @type spec :: %{adapter: :atom, config: map()} | map()
  
  @doc """
  Return a child spec defining all processes required by the specific adapter.
  """
  @callback child_spec(spec) :: [:supervisor.child_spec()]
end

