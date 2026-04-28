import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-tag-pill',
  standalone: false,
  template: `<span class="tag-pill" [class.tag-pill--md]="size === 'md'" [style.background-color]="color">{{ name }}</span>`,
  styleUrls: ['./tag-pill.component.scss']
})
export class TagPillComponent {
  @Input() name: string = '';
  @Input() color: string = '#e0e0e0';
  @Input() size: 'sm' | 'md' = 'sm';
}
