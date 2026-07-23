"use client";

import {
  Editable,
  EditableArea,
  EditableCancelTrigger,
  EditableContext,
  EditableControl,
  EditableEditTrigger,
  EditableInput,
  EditablePreview,
  EditableSubmitTrigger,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Editable defaultValue="Kanzo UI" activationMode="dblclick">
      <EditableArea>
        <EditablePreview />
        <EditableInput />
      </EditableArea>

      <EditableControl>
        <EditableContext>
          {(editable) =>
            editable.editing ? (
              <>
                <EditableSubmitTrigger />
                <EditableCancelTrigger />
              </>
            ) : (
              <EditableEditTrigger />
            )
          }
        </EditableContext>
      </EditableControl>
    </Editable>
  );
}
