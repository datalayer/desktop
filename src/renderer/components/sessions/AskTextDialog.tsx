/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * A text asked of the person (a session's new title, a credential typed
 * once): one field, confirmed or declined. A secret field shows nothing of
 * what is typed.
 *
 * @module renderer/components/sessions/AskTextDialog
 */

import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  FormControl,
  Text,
  TextInput,
} from '@primer/react';

/** What is asked. */
export interface TextQuestion {
  title: string;
  /** The field's label. */
  label: string;
  /** What the field holds to begin with. */
  value: string;
  /** A sentence under the title, when there is one to say. */
  says?: string;
  /** Whether what is typed is a secret: hidden, never echoed. */
  secret?: boolean;
  /** The confirm button's word. */
  confirm?: string;
}

/** Props for {@link AskTextDialog}. */
export interface AskTextDialogProps {
  question: TextQuestion;
  /** The text, or `undefined` when declined. */
  onAnswer: (text: string | undefined) => void;
}

/**
 * The dialog.
 *
 * @param props - Component props.
 *
 * @returns React element.
 */
export function AskTextDialog(props: AskTextDialogProps): React.JSX.Element {
  const { question, onAnswer } = props;
  const [value, setValue] = useState(question.value);
  const confirm = () => onAnswer(value);
  return (
    <Dialog onClose={() => onAnswer(undefined)} title={question.title}>
      <Box sx={{ p: 3 }} data-testid="ask-text">
        {question.says ? (
          <Text as="p" sx={{ mt: 0, mb: 3, color: 'fg.muted' }}>
            {question.says}
          </Text>
        ) : null}
        <FormControl>
          <FormControl.Label>{question.label}</FormControl.Label>
          <TextInput
            type={question.secret ? 'password' : 'text'}
            value={value}
            onChange={event => setValue(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                confirm();
              }
            }}
            autoFocus
            sx={{ width: '100%' }}
          />
        </FormControl>
        <Box
          sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}
        >
          <Button onClick={() => onAnswer(undefined)}>Cancel</Button>
          <Button variant="primary" onClick={confirm}>
            {question.confirm ?? 'OK'}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}

export default AskTextDialog;
