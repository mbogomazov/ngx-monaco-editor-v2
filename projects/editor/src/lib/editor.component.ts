import { Component, forwardRef, Inject, Input, NgZone } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { fromEvent } from 'rxjs';
import * as Monaco from 'monaco-editor';

import { emmetHTML, emmetCSS, emmetJSX, Dispose } from 'emmet-monaco-es';

import { BaseEditor } from './base-editor';
import { NGX_MONACO_EDITOR_CONFIG, NgxMonacoEditorConfig } from './config';
import { NgxEditorModel } from './types';

declare var monaco: any;

@Component({
  selector: 'ngx-monaco-editor',
  template: '<div class="editor-container" #editorContainer></div>',
  styles: [
    `
      :host {
        display: block;
        height: 200px;
      }

      .editor-container {
        width: 100%;
        height: 98%;
      }
    `,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => EditorComponent),
      multi: true,
    },
  ],
})
export class EditorComponent
  extends BaseEditor
  implements ControlValueAccessor
{
  private _value: string = '';

  propagateChange = (_: any) => {};
  onTouched = () => {};

  @Input('options')
  set options(options: any) {
    this._options = Object.assign({}, this.config.defaultOptions, options);
    if (this._editor) {
      this._editor.dispose();
      this.initMonaco(options, this.insideNg);
    }
  }

  get options(): any {
    return this._options;
  }

  @Input('model')
  set model(model: NgxEditorModel) {
    this.options.model = model;
    if (this._editor) {
      this._editor.dispose();
      this.initMonaco(this.options, this.insideNg);
    }
  }

  constructor(
    private zone: NgZone,
    @Inject(NGX_MONACO_EDITOR_CONFIG)
    private editorConfig: NgxMonacoEditorConfig
  ) {
    super(editorConfig);
  }

  writeValue(value: any): void {
    this._value = value || '';

    // Fix for value change while dispose in process.
    setTimeout(() => {
      if (this._editor && !this.options.model) {
        this._editor.setValue(this._value);
      }
    });
  }

  registerOnChange(fn: () => void): void {
    this.propagateChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  protected initMonaco(options: any, insideNg: boolean): void {
    const hasModel = !!options.model;

    if (options.useEmmet) {
      this.initEmmet(options);
    }

    if (hasModel) {
      const model = monaco.editor.getModel(options.model.uri || '');

      if (model) {
        options.model = model;
        options.model.setValue(this._value);
      } else {
        options.model = monaco.editor.createModel(
          options.model.value,
          options.model.language,
          options.model.uri
        );
      }
    }

    if (insideNg) {
      this.createMonaco(options);
    } else {
      this.zone.runOutsideAngular(() => {
        this.createMonaco(options);
      });
    }

    if (!hasModel) {
      this._editor.setValue(this._value);
    }

    this._editor.onDidChangeModelContent(() => {
      const value = this._editor.getValue();

      // value is not propagated to parent when executing outside zone.
      this.zone.run(() => {
        this.propagateChange(value);
        this._value = value;
      });
    });

    this._editor.onDidBlurEditorWidget(() => {
      this.onTouched();
    });

    // refresh layout on resize event.
    if (this._windowResizeSubscription) {
      this._windowResizeSubscription.unsubscribe();
    }
    this._windowResizeSubscription = fromEvent(window, 'resize').subscribe(() =>
      this._editor.layout()
    );

    this.onInit.emit(this._editor);
  }

  private createMonaco(options) {
    this._editor = monaco.editor.create(
      this._editorContainer.nativeElement,
      options
    );
  }

  private initEmmet(options: any) {
    const emmetInitializers: Record<
      string,
      (monaco?: typeof Monaco, languages?: string[]) => Dispose
    > = {
      html: emmetHTML,
      css: emmetCSS,
      javascript: emmetJSX,
    };

    // TODO: implement emmet dispose
    emmetInitializers[options.language]();
  }
}
