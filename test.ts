import { Stream } from './Stream';
enum TheError {
    NotFound = 'NotFound', ArgumentError = 'ArgumentError'
}
enum Comparers {
    ['<'] = -1, ['='] = 0, ['>'] = 1
}
type IEqual<T> = (x: T, y: T) => boolean;
type IPredicate<T> = (v: T) => boolean;
type ISelector<TSource, TResult> = (v: TSource) => TResult;
type IComparer<T> = (x: T, y: T) => Comparers;
const Equal: IEqual<any> = (x, y) => x === y;
const Predicate: IPredicate<any> = v => true;
const Selector: ISelector<any, any> = v => v;
export class Enumerable<T>{
    public readonly GetStream: () => Stream<T>;
    public constructor(s: Stream<T>) {
        this.GetStream = () => s;
    }
    [Symbol.iterator](): Iterator<T> {
        return this.GetStream()[Symbol.iterator]();
    }
    public static CreateFrom<T>(iterable: Iterable<T>): Enumerable<T> {
        return new Enumerable(Stream.CreateFrom(iterable));
    }
    public static Empty<T>(): Enumerable<T> {
        return new Enumerable(Stream.Empty());
    }
    public static Range(start: number, count: number): Enumerable<number> {
        return new Enumerable(new Stream(Stream.Head, () => Create.Range(start, count)));
    }
    public static Repeat<T>(element: T, count: number): Enumerable<T> {
        return new Enumerable(new Stream(Stream.Head, () => Create.Repeat(element, count)));
    }
    public Aggregate(product: (lastResult: T, currentValue: T) => T): T;
    public Aggregate<TAccumulate>(seed: TAccumulate, product: (lastResult: TAccumulate, currentValue: T) => TAccumulate): TAccumulate;
    public Aggregate<TAccumulate, TResult>(seed: TAccumulate, product: (lastResult: TAccumulate, currentValue: T) => TAccumulate, resultSelector: ISelector<TAccumulate, TResult>): TResult;
    public Aggregate(arg0: any, arg1?: any, arg2?: any): any {
        if (ESType.function(arg0) && ESType.undefined(arg1) && ESType.undefined(arg2)) {
            return this.GetStream().reduce(arg0);
        }
        if (ESType.any(arg0) && ESType.function(arg1) && ESType.undefined(arg2)) {
            return this.GetStream().reduce(arg1, arg0);
        }
        if (ESType.any(arg0) && ESType.function(arg1) && ESType.function(arg2)) {
            return arg2(this.GetStream().reduce(arg1, arg0));
        }
        throw TheError.ArgumentError;
    }
    public All(predicate: IPredicate<T>): boolean {
        return !this.GetStream().has(v => !predicate(v));
    }
    public Any(predicate: IPredicate<T> = Predicate) {
        return this.GetStream().has(predicate);
    }
    public Average(selector: ISelector<T, number> = Selector): number {
        var i = 0;
        return this.GetStream().reduce((avg, x) => avg += (selector(x) - avg) / (i++ + 1), 0);
    }
    public Concat(second: Enumerable<T>): Enumerable<T> {
        return new Enumerable(this.GetStream().concat(second.GetStream()));
    };
    public Contains(value: T, equal: IEqual<T> = Equal): boolean {
        return this.GetStream().has(v => equal(value, v));
    }
    public Count(predicate: IPredicate<T> = Predicate): number {
        return this.GetStream().reduce((l, c) => predicate(c) ? l + 1 : l, 0);
    }
    public DefaultIfEmpty(defaultValue: T): Enumerable<T> {
        return new Enumerable(new Stream(Stream.Head, () => {
            var s = this.GetStream().next();
            return Stream.IsEnd(s) ? new Stream(defaultValue, Stream.End) : s;
        }));
    }
    public Distinct(equal: IEqual<T> = Equal): Enumerable<T> {
        return new Enumerable(this.GetStream().distinct(equal));
    }
    public ElementAt(index: number): T {
        return this.GetStream().ref(v => index-- === 0 ? true : false);
    }
    public Except(second: Enumerable<T>, equal: IEqual<T> = Equal): Enumerable<T> {
        return new Enumerable(this.GetStream().except(second.GetStream(), equal));
    }
    public First(predicate: IPredicate<T> = Predicate): T {
        return this.GetStream().ref(predicate);
    }
    public GroupBy<TKey>(keySelector: ISelector<T, TKey>): Enumerable<Grouping<TKey, T>>;
    public GroupBy<TKey>(keySelector: ISelector<T, TKey>, equal: IEqual<TKey>): Enumerable<Grouping<TKey, T>>;
    public GroupBy<TKey, TElement>(keySelector: ISelector<T, TKey>, equal: IEqual<TKey>, elementSelector: ISelector<T, TElement>): Enumerable<Grouping<TKey, TElement>>;
    public GroupBy<TKey, TElement, TResult>(keySelector: ISelector<T, TKey>, equal: IEqual<TKey>, elementSelector: ISelector<T, TElement>, resultSelector: (key: TKey, elements: Enumerable<TElement>) => TResult): Enumerable<TResult>;
    public GroupBy(keySelector: any, equal = Equal, elementSelector = Selector, resultSelector?: any): any {
        var s: Stream<Grouping<any, any>> = new Stream(Stream.Head, () => Create.GroupBy(keySelector, equal, elementSelector, this.GetStream().next()));
        return ESType.function(resultSelector) ? new Enumerable(s.map(v => resultSelector(v.Key, v))) : new Enumerable(s);
    }
    public GroupJoin<TInner, TKey, TResult>(inner: Enumerable<TInner>, outerKeySelector: ISelector<T, TKey>, innerKeySelector: ISelector<TInner, TKey>, resultSelector: (outer: T, inners: Enumerable<TInner>) => TResult, equal: IEqual<TKey> = Equal): Enumerable<TResult> {

    }
}
export class Grouping<TKey, TElement> extends Enumerable<TElement>{
    public readonly Key: TKey;
    public constructor(key: TKey, elements: Stream<TElement>) {
        super(elements);
        this.Key = key;
    }
}
const Create = {
    Range: function create(start: number, count: number): Stream<number> {
        return count === 0 ? Stream.End : new Stream(start, () => create(start + 1, count - 1));
    },
    Repeat: function create<T>(element: T, count: number): Stream<T> {
        return count === 0 ? Stream.End : new Stream(element, () => create(element, count - 1));
    },
    GroupBy: function create<T, TKey, TElement>(keySelector: ISelector<T, TKey>, equal: IEqual<TKey>, elementSelector: ISelector<T, TElement>, s: Stream<T>): Stream<Grouping<TKey, TElement>> {
        if (Stream.IsEnd(s)) {
            return Stream.End;
        }
        else {
            var key = keySelector(s.v), value = elementSelector(s.v);
            var [result, rest] = s.shunt(v => equal(key, keySelector(v)));
            return new Stream(new Grouping(key, Stream.Create(value, () => result.map(elementSelector).next())),
                () => create(keySelector, equal, elementSelector, rest.next()));
        }
    }
};
const ESType = {
    string: (o: any) => typeof (o) === 'string',
    number: (o: any) => typeof (o) === 'number',
    boolean: (o: any) => typeof (o) === 'boolean',
    symbol: (o: any) => typeof (o) === 'symbol',
    undefined: (o: any) => typeof (o) === 'undefined',
    object: (o: any) => typeof (o) === 'object',
    function: (o: any) => typeof (o) === 'function',
    any: (o: any) => true
}