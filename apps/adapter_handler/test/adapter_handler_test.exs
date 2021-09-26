defmodule AdapterHandlerTest do
  use ExUnit.Case
  doctest AdapterHandler

  test "greets the world" do
    assert AdapterHandler.hello() == :world
  end
end
